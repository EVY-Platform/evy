import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
	DATA_EVY_Rows,
	GetRequest,
	GetResponse,
	UpsertRequest,
} from "evy-types";
import { NAMESPACE_VALUES } from "evy-types";
import { emitJsonRpc } from "./ws";

type RpcServer = Awaited<ReturnType<typeof import("./ws")["initServer"]>>;

function resolveServiceProtoPath(): string {
	const fromSource = join(
		dirname(fileURLToPath(import.meta.url)),
		"../../types/schema/service.proto",
	);
	if (existsSync(fromSource)) {
		return fromSource;
	}
	const fromApiSibling = join(process.cwd(), "../types/schema/service.proto");
	if (existsSync(fromApiSibling)) {
		return fromApiSibling;
	}
	const fromDocker = join(process.cwd(), "types/schema/service.proto");
	if (existsSync(fromDocker)) {
		return fromDocker;
	}
	throw new Error("Could not resolve types/schema/service.proto");
}

let grpcPackageRoot: grpc.GrpcObject | null = null;

function loadEvyServiceConstructor(): grpc.ServiceClientConstructor {
	if (!grpcPackageRoot) {
		const protoPath = resolveServiceProtoPath();
		const packageDefinition = protoLoader.loadSync(protoPath, {
			keepCase: true,
			longs: String,
			enums: String,
			defaults: true,
			oneofs: true,
		});
		grpcPackageRoot = grpc.loadPackageDefinition(
			packageDefinition,
		) as grpc.GrpcObject;
	}
	const evyPkg = grpcPackageRoot.evy as {
		Service: grpc.ServiceClientConstructor;
	};
	return evyPkg.Service;
}

type ServiceAdapter = {
	get(params: GetRequest): Promise<GetResponse>;
	upsert(params: UpsertRequest): Promise<DATA_EVY_Rows>;
	onEvent(listener: (eventName: string, payload: unknown) => void): void;
};

type GrpcServiceClient = grpc.Client & {
	Get: (
		request: {
			namespace: string;
			resource: string;
			filter?: { id: string };
		},
		callback: grpc.requestCallback<{ result_json: string }>,
	) => grpc.ClientUnaryCall;
	Upsert: (
		request: {
			namespace: string;
			resource: string;
			filter?: { id: string };
			data_json: string;
		},
		callback: grpc.requestCallback<{ result_json: string }>,
	) => grpc.ClientUnaryCall;
	SubscribeEvents: (
		request: Record<string, never>,
	) => grpc.ClientReadableStream<{
		event_name: string;
		payload_json: string;
	}>;
};

function buildProtoGetRequest(params: GetRequest) {
	return {
		namespace: params.namespace,
		resource: params.resource,
		...(params.filter?.id ? { filter: { id: params.filter.id } } : {}),
	};
}

function makeGrpcAdapter(
	namespace: string,
	url: string,
	ServiceClientCtor: grpc.ServiceClientConstructor,
): ServiceAdapter {
	const client = new ServiceClientCtor(
		url,
		grpc.credentials.createInsecure(),
	) as GrpcServiceClient;

	let eventListener: ((eventName: string, payload: unknown) => void) | null =
		null;
	let eventStream: grpc.ClientReadableStream<{
		event_name: string;
		payload_json: string;
	}> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelayMs = 1000;
	const RECONNECT_MS_MAX = 30_000;

	function scheduleReconnect(): void {
		if (reconnectTimer) {
			return;
		}
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MS_MAX);
			startSubscribeStream();
		}, reconnectDelayMs);
	}

	function startSubscribeStream(): void {
		if (!eventListener) {
			return;
		}
		if (eventStream) {
			eventStream.removeAllListeners();
			eventStream.cancel();
			eventStream = null;
		}
		const stream = client.SubscribeEvents({});
		eventStream = stream;
		reconnectDelayMs = 1000;

		stream.on("data", (msg) => {
			eventListener?.(msg.event_name, JSON.parse(msg.payload_json) as unknown);
		});
		stream.on("error", () => {
			if (eventStream === stream) {
				eventStream = null;
			}
			scheduleReconnect();
		});
		stream.on("end", () => {
			if (eventStream === stream) {
				eventStream = null;
			}
			scheduleReconnect();
		});
	}

	return {
		get: (params) =>
			new Promise<GetResponse>((resolve, reject) => {
				client.Get(buildProtoGetRequest(params), (err, response) => {
					if (err) {
						reject(err);
						return;
					}
					if (!response) {
						reject(new Error(`Empty Get response from ${namespace} service`));
						return;
					}
					resolve(JSON.parse(response.result_json) as GetResponse);
				});
			}),
		upsert: (params) =>
			new Promise<DATA_EVY_Rows>((resolve, reject) => {
				client.Upsert(
					{
						...buildProtoGetRequest(params),
						data_json: JSON.stringify(params.data),
					},
					(err, response) => {
						if (err) {
							reject(err);
							return;
						}
						if (!response) {
							reject(
								new Error(`Empty Upsert response from ${namespace} service`),
							);
							return;
						}
						resolve(JSON.parse(response.result_json) as DATA_EVY_Rows);
					},
				);
			}),
		onEvent(listener) {
			eventListener = listener;
			startSubscribeStream();
		},
	};
}

let grpcAdapters: Map<string, ServiceAdapter> | null = null;

function getGrpcAdapters(): Map<string, ServiceAdapter> {
	if (grpcAdapters) {
		return grpcAdapters;
	}
	const next = new Map<string, ServiceAdapter>();
	const ServiceCtor = loadEvyServiceConstructor();
	for (const namespace of NAMESPACE_VALUES) {
		if (namespace === "evy") {
			continue;
		}
		const envKey = `${namespace.toUpperCase()}_GRPC_URL`;
		const url = process.env[envKey];
		if (!url?.trim()) {
			throw new Error(
				`Missing ${envKey}: every non-evy namespace must declare its gRPC URL (host:port, no scheme).`,
			);
		}
		next.set(namespace, makeGrpcAdapter(namespace, url.trim(), ServiceCtor));
	}
	grpcAdapters = next;
	return grpcAdapters;
}

export function forwardGet(
	namespace: string,
	params: GetRequest,
): Promise<GetResponse> {
	const adapter = getGrpcAdapters().get(namespace);
	if (!adapter) {
		throw new Error(`No service registered for namespace ${namespace}`);
	}
	return adapter.get(params);
}

export function forwardUpsert(
	namespace: string,
	params: UpsertRequest,
): Promise<DATA_EVY_Rows> {
	const adapter = getGrpcAdapters().get(namespace);
	if (!adapter) {
		throw new Error(`No service registered for namespace ${namespace}`);
	}
	return adapter.upsert(params);
}

export function wireGrpcClientsTo(server: RpcServer): void {
	for (const adapter of getGrpcAdapters().values()) {
		adapter.onEvent((eventName, payload) => {
			emitJsonRpc(server, eventName, payload);
		});
	}
}
