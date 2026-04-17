import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import type { Client } from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type { GetRequest, UpsertRequest } from "evy-types";

import { get, upsert } from "./data";

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
	const fromSource = join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../types/schema/service.proto",
	);
	if (existsSync(fromSource)) {
		return fromSource;
	}
	const fromServiceCwd = join(
		process.cwd(),
		"../../types/schema/service.proto",
	);
	if (existsSync(fromServiceCwd)) {
		return fromServiceCwd;
	}
	const fromDocker = join(process.cwd(), "types/schema/service.proto");
	if (existsSync(fromDocker)) {
		return fromDocker;
	}
	throw new Error("Could not resolve types/schema/service.proto");
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

	return {
		service: evyPackage.Service.service,
		implementation: {
			Get: (
				call: grpc.ServerUnaryCall<
					{
						namespace: string;
						resource: string;
						filter?: { id: string };
					},
					{ result_json: string }
				>,
				cb: grpc.sendUnaryData<{ result_json: string }>,
			) => {
				void (async () => {
					try {
						const req = call.request;
						const params: GetRequest = {
							namespace: req.namespace as GetRequest["namespace"],
							resource: req.resource as GetRequest["resource"],
							filter: req.filter?.id ? { id: req.filter.id } : undefined,
						};
						const result = await get(params);
						cb(null, { result_json: JSON.stringify(result) });
					} catch (err) {
						cb({
							code: grpc.status.INTERNAL,
							message: err instanceof Error ? err.message : String(err),
						});
					}
				})();
			},
			Upsert: (
				call: grpc.ServerUnaryCall<
					{
						namespace: string;
						resource: string;
						filter?: { id: string };
						data_json: string;
					},
					{ result_json: string }
				>,
				cb: grpc.sendUnaryData<{ result_json: string }>,
			) => {
				void (async () => {
					try {
						const req = call.request;
						let data: UpsertRequest["data"];
						try {
							data = JSON.parse(req.data_json) as UpsertRequest["data"];
						} catch (parseErr) {
							cb({
								code: grpc.status.INVALID_ARGUMENT,
								message:
									parseErr instanceof Error
										? `Invalid data_json: ${parseErr.message}`
										: "Invalid data_json",
							});
							return;
						}
						const params: UpsertRequest = {
							namespace: req.namespace as GetRequest["namespace"],
							resource: req.resource as GetRequest["resource"],
							filter: req.filter?.id ? { id: req.filter.id } : undefined,
							data,
						};
						const result = await upsert(params);
						eventBus.emit("notify", "dataUpdated", result);
						cb(null, { result_json: JSON.stringify(result) });
					} catch (err) {
						cb({
							code: grpc.status.INTERNAL,
							message: err instanceof Error ? err.message : String(err),
						});
					}
				})();
			},
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
		},
	};
}

export type StartMarketplaceGrpcOptions = {
	host?: string;
	port?: number;
};

function resolveGrpcListenPort(options: StartMarketplaceGrpcOptions): number {
	if (options.port !== undefined) {
		return options.port;
	}
	if (!process.env.MARKETPLACE_GRPC_PORT) {
		throw new Error("MARKETPLACE_GRPC_PORT environment variable is not set");
	}
	return Number.parseInt(process.env.MARKETPLACE_GRPC_PORT, 10);
}

function resolveGrpcListenHost(options: StartMarketplaceGrpcOptions): string {
	if (options.host !== undefined) {
		return options.host;
	}
	if (!process.env.MARKETPLACE_GRPC_HOST) {
		throw new Error("MARKETPLACE_GRPC_HOST environment variable is not set");
	}
	return process.env.MARKETPLACE_GRPC_HOST;
}

export async function startMarketplaceGrpcServer(
	options: StartMarketplaceGrpcOptions = {},
): Promise<number> {
	const host = resolveGrpcListenHost(options);
	const port = resolveGrpcListenPort(options);
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
