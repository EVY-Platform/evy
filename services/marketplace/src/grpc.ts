import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import type { Client } from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type { UpsertRequest } from "evy-types";

import { get, upsert } from "./data";
import {
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import { MARKETPLACE_RESOURCE_NAMES } from "./catalog";

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

let serverInstance: grpc.Server | null = null;

function buildMarketplaceServiceHandlers(
	root: grpc.GrpcObject,
	eventBus: EventEmitter,
) {
	const evyPackage = root.evy as { Service: grpc.ServiceClientConstructor };

	type GetRequestShape = {
		service: string;
		resource: string;
		filter?: { id?: string; updated_after?: string };
	};

	type UpsertRequestShape = {
		service: string;
		resource: string;
		filter?: { id?: string };
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

	return {
		service: evyPackage.Service.service,
		implementation: {
			Get: asyncUnaryHandler<GetRequestShape, { result_json: string }>(
				async (req) => {
					const filter: {
						id?: string;
						updatedAfter?: string;
					} = {};
					if (req.filter?.id) filter.id = req.filter.id;
					if (req.filter?.updated_after)
						filter.updatedAfter = req.filter.updated_after;
					const params = {
						service: req.service,
						resource: req.resource,
						filter: Object.keys(filter).length > 0 ? filter : undefined,
					};
					validateStrictGetRequest(params);
					const result = await get(params);
					return { result_json: JSON.stringify(result) } as const;
				},
			),
			Upsert: asyncUnaryHandler<UpsertRequestShape, { result_json: string }>(
				async (req) => {
					let data: UpsertRequest["data"];
					try {
						data = JSON.parse(req.data_json) as UpsertRequest["data"];
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
					const params = {
						service: req.service,
						resource: req.resource,
						filter: req.filter?.id ? { id: req.filter.id } : undefined,
						data,
					};
					validateStrictUpsertRequest(params);
					const result = await upsert(params);
					eventBus.emit("notify", "dataUpdated", result);
					return { result_json: JSON.stringify(result) } as const;
				},
			),
			SubscribeEvents: (call: grpc.ServerWritableStream<unknown, unknown>) => {
				const listener = (eventName: string, payload: unknown) => {
					tryWriteSubscribeEvent(call, eventName, payload);
				};
				eventBus.on("notify", listener);
				const cleanup = () => {
					eventBus.off("notify", listener);
				};
				call.on("cancelled", cleanup);
				call.on("close", cleanup);
			},
			ListResources: (
				_call: grpc.ServerUnaryCall<
					Record<string, never>,
					{ resources: string[] }
				>,
				cb: grpc.sendUnaryData<{ resources: string[] }>,
			) => {
				cb(null, {
					resources: [...MARKETPLACE_RESOURCE_NAMES],
				});
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

	const marketplaceEventBus = new EventEmitter();
	marketplaceEventBus.setMaxListeners(0);

	const { service, implementation } = buildMarketplaceServiceHandlers(
		root,
		marketplaceEventBus,
	);
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
				console.info(`Marketplace gRPC listening at ${host}:${boundPort}`);
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
