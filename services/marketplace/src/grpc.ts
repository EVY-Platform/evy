import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@grpc/grpc-js";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import {
	validateStrictApiRequest,
	validateStrictCreateRequest,
	validateStrictDeleteRequest,
	validateStrictGetRequest,
	validateStrictUpdateRequest,
} from "evy-types/rpcRequestHelpers";
import { create, deleteResource, get, update } from "./data";
import { offServiceEvent, onServiceEvent } from "./events";

/**
 * Best-effort write for server-streaming SubscribeEvents. If the client has
 * half-closed the stream, `write` throws; we ignore that so the listener does
 * not tear down unrelated work.
 */
function tryWriteSubscribeEvent(
	call: grpc.ServerWritableStream<unknown, unknown>,
	eventName: string,
	payload: unknown,
): void {
	try {
		call.write({
			event_name: eventName,
			payload_json: JSON.stringify(payload),
		});
	} catch {
		// Half-closed stream or backpressure — drop notification for this subscriber.
	}
}

function resolveMarketplaceServiceProtoPath(): string {
	const candidates = [
		join(
			dirname(fileURLToPath(import.meta.url)),
			"../../../types/schema/service.proto",
		),
		join(process.cwd(), "../../types/schema/service.proto"),
		join(process.cwd(), "types/schema/service.proto"),
	];
	const found = candidates.find(existsSync);
	if (!found) throw new Error("Could not resolve types/schema/service.proto");
	return found;
}

let evyServiceGrpcPackageRoot: grpc.GrpcObject | null = null;

function loadEvyServiceGrpcRoot(): grpc.GrpcObject {
	if (!evyServiceGrpcPackageRoot) {
		const packageDefinition = protoLoader.loadSync(
			resolveMarketplaceServiceProtoPath(),
			{
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		);
		evyServiceGrpcPackageRoot = grpc.loadPackageDefinition(
			packageDefinition,
		) as grpc.GrpcObject;
	}
	return evyServiceGrpcPackageRoot;
}

/** gRPC client for tests or tooling; `address` is `host:port` with no scheme. */
export function createEvyServiceClient(address: string): Client {
	const root = loadEvyServiceGrpcRoot();
	const Client = (root.evy as { Service: grpc.ServiceClientConstructor })
		.Service;
	return new Client(address, grpc.credentials.createInsecure());
}

function parseDataJson(raw: string): object {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (parseErr) {
		throw Object.assign(
			new Error(
				parseErr instanceof Error
					? `Invalid data_json: ${parseErr.message}`
					: "Invalid data_json",
			),
			{ code: grpc.status.INVALID_ARGUMENT },
		);
	}
	if (data === undefined || data === null || typeof data !== "object") {
		throw Object.assign(
			new Error("data is required and must be a non-null object"),
			{ code: grpc.status.INVALID_ARGUMENT },
		);
	}
	return data;
}

let serverInstance: grpc.Server | null = null;

function buildMarketplaceServiceHandlers(root: grpc.GrpcObject) {
	const evyPackage = root.evy as { Service: grpc.ServiceClientConstructor };

	type GetRequestShape = {
		service: string;
		resource: string;
		filter?: { id?: string; updated_after?: string };
	};

	type ResourceRequestShape = {
		service: string;
		resource: string;
		filter?: { id?: string; updated_after?: string };
	};

	type CreateRequestShape = ResourceRequestShape & {
		data_json: string;
	};

	type UpdateRequestShape = ResourceRequestShape & {
		data_json: string;
	};

	function asyncUnaryHandler<Req, Res>(
		handler: (req: Req) => Promise<Res>,
	): (
		call: grpc.ServerUnaryCall<Req, Res>,
		cb: grpc.sendUnaryData<Res>,
	) => void {
		return (call, cb) => {
			void (async () => {
				try {
					const result = await handler(call.request);
					cb(null, result);
				} catch (err) {
					const error = err as Error & { code?: number };
					cb({
						code: error.code ?? grpc.status.INTERNAL,
						message: error.message ?? String(err),
					});
				}
			})();
		};
	}

	type ApiRequestShape = {
		service: string;
		resource?: string;
		method: string;
		filter?: { id?: string; updated_after?: string };
		data_json?: string;
	};

	function buildFilter(req: {
		filter?: { id?: string; updated_after?: string };
	}): { id?: string; updatedAfter?: string } | undefined {
		const filter: {
			id?: string;
			updatedAfter?: string;
		} = {};
		if (req.filter?.id) filter.id = req.filter.id;
		if (req.filter?.updated_after)
			filter.updatedAfter = req.filter.updated_after;
		return Object.keys(filter).length > 0 ? filter : undefined;
	}

	return {
		service: evyPackage.Service.service,
		implementation: {
			Get: asyncUnaryHandler<GetRequestShape, { result_json: string }>(
				async (req) => {
					const params = {
						service: req.service,
						resource: req.resource,
						filter: buildFilter(req),
					};
					validateStrictGetRequest(params);
					const result = await get(params);
					return { result_json: JSON.stringify(result) } as const;
				},
			),
			Create: asyncUnaryHandler<
				CreateRequestShape,
				{ result_json: string }
			>(async (req) => {
				const params = {
					service: req.service,
					resource: req.resource,
					filter: buildFilter(req),
					data: parseDataJson(req.data_json),
				};
				validateStrictCreateRequest(params);
				const result = await create(params);
				return { result_json: JSON.stringify(result) } as const;
			}),
			Update: asyncUnaryHandler<
				UpdateRequestShape,
				{ result_json: string }
			>(async (req) => {
				const params = {
					service: req.service,
					resource: req.resource,
					filter: buildFilter(req),
					data: parseDataJson(req.data_json),
				};
				validateStrictUpdateRequest(params);
				const result = await update(params);
				return { result_json: JSON.stringify(result) } as const;
			}),
			Delete: asyncUnaryHandler<
				ResourceRequestShape,
				{ result_json: string }
			>(async (req) => {
				const params = {
					service: req.service,
					resource: req.resource,
					filter: buildFilter(req),
				};
				validateStrictDeleteRequest(params);
				const result = await deleteResource(params);
				return { result_json: JSON.stringify(result) } as const;
			}),
			Api: asyncUnaryHandler<ApiRequestShape, { result_json: string }>(
				async (req) => {
					const params = {
						service: req.service,
						...(req.resource ? { resource: req.resource } : {}),
						method: req.method,
						filter: buildFilter(req),
						...(req.data_json
							? { data: parseDataJson(req.data_json) }
							: {}),
					};
					validateStrictApiRequest(params);
					throw new Error(
						`Unknown marketplace API method: ${params.method}`,
					);
				},
			),
			SubscribeEvents: (
				call: grpc.ServerWritableStream<unknown, unknown>,
			) => {
				const listener = (eventName: string, payload: unknown) => {
					tryWriteSubscribeEvent(call, eventName, payload);
				};
				onServiceEvent(listener);
				const cleanup = () => {
					offServiceEvent(listener);
				};
				call.on("cancelled", cleanup);
				call.on("close", cleanup);
			},
		},
	};
}

type StartMarketplaceGrpcOptions = {
	host?: string;
	port?: number;
};

export async function startMarketplaceGrpcServer(
	options: StartMarketplaceGrpcOptions = {},
): Promise<number> {
	const getEnv = (key: string): string => {
		const v = process.env[key];
		if (!v) throw new Error(`${key} environment variable is not set`);
		return v;
	};
	const host = options.host ?? getEnv("MARKETPLACE_GRPC_HOST");
	const port =
		options.port ?? Number.parseInt(getEnv("MARKETPLACE_GRPC_PORT"), 10);
	const root = loadEvyServiceGrpcRoot();

	const { service, implementation } = buildMarketplaceServiceHandlers(root);
	const server = new grpc.Server();
	server.addService(service, implementation);
	serverInstance = server;

	await new Promise<void>((resolve, reject) => {
		server.bindAsync(
			`${host}:${port}`,
			grpc.ServerCredentials.createInsecure(),
			(err, boundPort) => {
				if (err) {
					reject(err);
					return;
				}
				console.info(
					`Marketplace gRPC listening at ${host}:${boundPort}`,
				);
				resolve();
			},
		);
	});

	return port;
}

export function stopMarketplaceGrpcServer(): void {
	if (serverInstance) {
		serverInstance.forceShutdown();
		serverInstance = null;
	}
}
