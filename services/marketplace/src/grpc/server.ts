import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type { GetRequest, UpsertRequest } from "evy-types";

import { get, upsert } from "../data";

const marketplaceEventBus = new EventEmitter();
marketplaceEventBus.setMaxListeners(0);

function getProtoPath(): string {
	const fromSource = join(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../types/schema/service.proto",
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

function getGrpcListenPort(): number {
	if (!process.env.MARKETPLACE_GRPC_PORT) {
		throw new Error("MARKETPLACE_GRPC_PORT environment variable is not set");
	}
	return Number.parseInt(process.env.MARKETPLACE_GRPC_PORT, 10);
}

function loadEvyServiceGrpcObject(): grpc.GrpcObject {
	const packageDefinition = protoLoader.loadSync(getProtoPath(), {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	});
	return grpc.loadPackageDefinition(packageDefinition) as grpc.GrpcObject;
}

function protoToGetParams(request: {
	namespace: string;
	resource: string;
	filter?: { id: string };
}): GetRequest {
	return {
		namespace: request.namespace as GetRequest["namespace"],
		resource: request.resource as GetRequest["resource"],
		filter: request.filter?.id ? { id: request.filter.id } : undefined,
	};
}

function protoToUpsertParams(request: {
	namespace: string;
	resource: string;
	filter?: { id: string };
	data_json: string;
}): UpsertRequest {
	return {
		...protoToGetParams(request),
		data: JSON.parse(request.data_json) as UpsertRequest["data"],
	};
}

let serverInstance: grpc.Server | null = null;

function addMarketplaceService(
	server: grpc.Server,
	root: grpc.GrpcObject,
): void {
	const evyPackage = root.evy as { Service: grpc.ServiceClientConstructor };

	server.addService(evyPackage.Service.service, {
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
					const params = protoToGetParams(call.request);
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
					const params = protoToUpsertParams(call.request);
					const result = await upsert(params);
					marketplaceEventBus.emit("notify", "dataUpdated", result);
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
			const listener = (_eventName: string, payload: unknown) => {
				try {
					call.write({
						event_name: "dataUpdated",
						payload_json: JSON.stringify(payload),
					});
				} catch {
					// Stream may be half-closed
				}
			};
			marketplaceEventBus.on("notify", listener);
			const cleanup = () => {
				marketplaceEventBus.off("notify", listener);
			};
			call.on("cancelled", cleanup);
			call.on("close", cleanup);
		},
	});
}

export type StartMarketplaceGrpcOptions = {
	port?: number;
};

export async function startMarketplaceGrpcServer(
	options: StartMarketplaceGrpcOptions = {},
): Promise<number> {
	const port = options.port ?? getGrpcListenPort();
	const root = loadEvyServiceGrpcObject();
	const server = new grpc.Server();
	addMarketplaceService(server, root);
	serverInstance = server;

	await new Promise<void>((resolve, reject) => {
		server.bindAsync(
			`0.0.0.0:${port}`,
			grpc.ServerCredentials.createInsecure(),
			(err, boundPort) => {
				if (err) {
					reject(err);
					return;
				}
				console.info(`Marketplace gRPC listening at 0.0.0.0:${boundPort}`);
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
