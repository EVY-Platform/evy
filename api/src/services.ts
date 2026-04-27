import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
	GetRequest,
	GetResponse,
	UpsertRequest,
	UpsertResponse,
} from "evy-types";
import { SERVICE_VALUES } from "evy-types";
import {
	validateGetResponse,
	validateUpsertResponse,
} from "evy-types/validators";
import { emitJsonRpc, type RpcServer } from "./ws";

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
	upsert(params: UpsertRequest): Promise<UpsertResponse>;
	onEvent(listener: (eventName: string, payload: unknown) => void): void;
};

type GrpcServiceClient = grpc.Client & {
	Get: (
		request: {
			service: string;
			resource: string;
			filter?: { id?: string; updated_after?: string };
		},
		callback: grpc.requestCallback<{ result_json: string }>,
	) => grpc.ClientUnaryCall;
	Upsert: (
		request: {
			service: string;
			resource: string;
			filter?: { id?: string; updated_after?: string };
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
	const filter: Record<string, string> = {};
	if (params.filter?.id) filter.id = params.filter.id;
	if (params.filter?.updatedAfter)
		filter.updated_after = params.filter.updatedAfter;

	return {
		service: params.service,
		resource: params.resource,
		...(Object.keys(filter).length > 0 ? { filter } : {}),
	};
}

function makeGrpcAdapter(
	serviceName: string,
	url: string,
	ServiceClientCtor: grpc.ServiceClientConstructor,
): ServiceAdapter {
	const client = new ServiceClientCtor(
		url,
		grpc.credentials.createInsecure(),
	) as unknown as GrpcServiceClient;

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
			let payload: unknown;
			try {
				payload = JSON.parse(msg.payload_json) as unknown;
			} catch {
				return;
			}
			eventListener?.(msg.event_name, payload);
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
						reject(new Error(`Empty Get response from ${serviceName} service`));
						return;
					}
					let parsed: unknown;
					try {
						parsed = JSON.parse(response.result_json) as unknown;
					} catch (parseErr) {
						reject(parseErr);
						return;
					}
					try {
						resolve(validateGetResponse(parsed));
					} catch (validationErr) {
						reject(validationErr);
					}
				});
			}),
		upsert: (params) =>
			new Promise<UpsertResponse>((resolve, reject) => {
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
								new Error(`Empty Upsert response from ${serviceName} service`),
							);
							return;
						}
						let parsed: unknown;
						try {
							parsed = JSON.parse(response.result_json) as unknown;
						} catch (parseErr) {
							reject(parseErr);
							return;
						}
						try {
							resolve(validateUpsertResponse(parsed));
						} catch (validationErr) {
							reject(validationErr);
						}
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
	for (const svc of SERVICE_VALUES) {
		if (svc === "evy") {
			continue;
		}
		const prefix = svc.toUpperCase();
		const hostKey = `${prefix}_GRPC_HOST`;
		const portKey = `${prefix}_GRPC_PORT`;
		const host = process.env[hostKey]?.trim();
		const port = process.env[portKey]?.trim();
		if (!host || !port) {
			throw new Error(
				`Missing ${hostKey} and/or ${portKey}: every non-evy service must declare its gRPC host and port.`,
			);
		}
		next.set(svc, makeGrpcAdapter(svc, `${host}:${port}`, ServiceCtor));
	}
	grpcAdapters = next;
	return grpcAdapters;
}

function getServiceAdapter(serviceName: string): ServiceAdapter {
	const adapter = getGrpcAdapters().get(serviceName);
	if (!adapter) {
		throw new Error(`No service registered for service ${serviceName}`);
	}
	return adapter;
}

export function forwardGet(
	serviceName: string,
	params: GetRequest,
): Promise<GetResponse> {
	return getServiceAdapter(serviceName).get(params);
}

export function forwardUpsert(
	serviceName: string,
	params: UpsertRequest,
): Promise<UpsertResponse> {
	return getServiceAdapter(serviceName).upsert(params);
}

export function wireGrpcClientsTo(server: RpcServer): void {
	for (const adapter of getGrpcAdapters().values()) {
		adapter.onEvent((eventName, payload) => {
			emitJsonRpc(server, eventName, payload);
		});
	}
}
