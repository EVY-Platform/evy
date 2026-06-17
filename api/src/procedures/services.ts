import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
	ApiRequest,
	GetRequest,
	GetResponse,
	CreateRequest,
	CreateResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
type BroadcastFn = (eventName: string, payload: unknown) => void;

import {
	validateGetResponse,
	validateCreateResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import { setServiceRegistry } from "evy-types/rpcRequestHelpers";
import {
	EVY_CORE_SERVICE,
	EVY_CORE_RESOURCE_NAMES,
} from "evy-types/coreResources";

function resolveServiceProtoPath(): string {
	const candidates = [
		join(
			dirname(fileURLToPath(import.meta.url)),
			"../../../types/schema/service.proto",
		),
		join(process.cwd(), "../types/schema/service.proto"),
		join(process.cwd(), "types/schema/service.proto"),
	];
	const found = candidates.find(existsSync);
	if (!found) throw new Error("Could not resolve types/schema/service.proto");
	return found;
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

type ForwardableGetRequest = GetRequest | ApiRequest;

type ProtoGetRequest = {
	service: string;
	resource: string;
	filter?: {
		id?: string;
		updated_after?: string;
	};
	method?: string;
};

type ProtoCreateRequest = {
	service: string;
	resource: string;
	filter?: { id?: string; updated_after?: string };
	data_json: string;
};

type ProtoUpdateRequest = {
	service: string;
	resource: string;
	filter: { id: string; updated_after?: string };
	data_json: string;
};

type ServiceAdapter = {
	get(params: ForwardableGetRequest): Promise<GetResponse>;
	create(params: CreateRequest): Promise<CreateResponse>;
	update(params: UpdateRequest): Promise<UpdateResponse>;
	listResources(): Promise<string[]>;
	onEvent(listener: (eventName: string, payload: unknown) => void): void;
};

type GrpcServiceClient = grpc.Client & {
	Get: (
		request: ProtoGetRequest,
		callback: grpc.requestCallback<{ result_json: string }>,
	) => grpc.ClientUnaryCall;
	Create: (
		request: ProtoCreateRequest,
		callback: grpc.requestCallback<{ result_json: string }>,
	) => grpc.ClientUnaryCall;
	Update: (
		request: ProtoUpdateRequest,
		callback: grpc.requestCallback<{ result_json: string }>,
	) => grpc.ClientUnaryCall;
	SubscribeEvents: (
		request: Record<string, never>,
	) => grpc.ClientReadableStream<{
		event_name: string;
		payload_json: string;
	}>;
	ListResources: (
		request: Record<string, never>,
		callback: grpc.requestCallback<{ resources: string[] }>,
	) => grpc.ClientUnaryCall;
};

function buildProtoFilter(
	filter: { id?: string; updatedAfter?: string } | undefined,
): Record<string, string> {
	const out: Record<string, string> = {};
	if (filter?.id) out.id = filter.id;
	if (filter?.updatedAfter) out.updated_after = filter.updatedAfter;
	return out;
}

function buildProtoGetRequest(params: {
	service: string;
	resource: string;
	filter?: { id?: string; updatedAfter?: string };
	method?: string;
}): ProtoGetRequest {
	const filter = buildProtoFilter(params.filter);

	return {
		service: params.service,
		resource: params.resource,
		...(Object.keys(filter).length > 0 ? { filter } : {}),
		...(params.method ? { method: params.method } : {}),
	};
}

function buildProtoCreateRequest(params: CreateRequest): ProtoCreateRequest {
	const filter = buildProtoFilter(params.filter);
	return {
		service: params.service,
		resource: params.resource,
		...(Object.keys(filter).length > 0 ? { filter } : {}),
		data_json: JSON.stringify(params.data),
	};
}

function buildProtoUpdateRequest(params: UpdateRequest): ProtoUpdateRequest {
	const filter = buildProtoFilter(params.filter);
	return {
		service: params.service,
		resource: params.resource,
		filter: { ...filter, id: params.filter.id },
		data_json: JSON.stringify(params.data),
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
	const reconnectMaxDelayMs = 30_000;

	function scheduleReconnect(): void {
		if (reconnectTimer) {
			return;
		}
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			reconnectDelayMs = Math.min(reconnectDelayMs * 2, reconnectMaxDelayMs);
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

	function callGrpcJsonMethod<TResponse>(
		grpcCall: (callback: grpc.requestCallback<{ result_json: string }>) => void,
		validate: (parsed: unknown) => TResponse,
		methodLabel: string,
	): Promise<TResponse> {
		return new Promise((resolve, reject) => {
			grpcCall((err, response) => {
				if (err) {
					reject(err);
					return;
				}
				if (!response) {
					reject(
						new Error(
							`Empty ${methodLabel} response from ${serviceName} service`,
						),
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
					resolve(validate(parsed));
				} catch (validationErr) {
					reject(validationErr);
				}
			});
		});
	}

	return {
		get: (params) =>
			callGrpcJsonMethod<GetResponse>(
				(cb) => client.Get(buildProtoGetRequest(params), cb),
				validateGetResponse,
				"Get",
			),
		create: (params) =>
			callGrpcJsonMethod<CreateResponse>(
				(cb) => client.Create(buildProtoCreateRequest(params), cb),
				validateCreateResponse,
				"Create",
			),
		update: (params) =>
			callGrpcJsonMethod<UpdateResponse>(
				(cb) => client.Update(buildProtoUpdateRequest(params), cb),
				validateUpdateResponse,
				"Update",
			),
		listResources: () =>
			new Promise<string[]>((resolve, reject) => {
				client.ListResources({}, (err, response) => {
					if (err) {
						reject(err);
						return;
					}
					if (!response) {
						reject(
							new Error(
								`Empty ListResources response from ${serviceName} service`,
							),
						);
						return;
					}
					resolve(response.resources);
				});
			}),
		onEvent(listener) {
			eventListener = listener;
			startSubscribeStream();
		},
	};
}

let grpcAdapters: Map<string, ServiceAdapter> | null = null;

/**
 * Returns environment-variable-based service configurations.
 * Each non-evy service must set {NAME}_GRPC_HOST and {NAME}_GRPC_PORT.
 * Add new services here as they are onboarded.
 */
function getServiceEnvConfigs(): [
	string,
	string | undefined,
	string | undefined,
][] {
	const knownServices = ["marketplace"];
	return knownServices.map((svc) => {
		const prefix = svc.toUpperCase();
		return [
			svc,
			process.env[`${prefix}_GRPC_HOST`],
			process.env[`${prefix}_GRPC_PORT`],
		] as const;
	});
}

function getGrpcAdapters(): Map<string, ServiceAdapter> {
	if (grpcAdapters) {
		return grpcAdapters;
	}
	const next = new Map<string, ServiceAdapter>();
	const ServiceCtor = loadEvyServiceConstructor();

	// Discover non-evy services from environment variables
	// Each service must declare {NAME}_GRPC_HOST and {NAME}_GRPC_PORT
	for (const [svc, hostVar, portVar] of getServiceEnvConfigs()) {
		const host = hostVar?.trim();
		const port = portVar?.trim();
		if (!host || !port) {
			throw new Error(
				`Missing ${svc.toUpperCase()}_GRPC_HOST and/or ${svc.toUpperCase()}_GRPC_PORT: every non-evy service must declare its gRPC host and port.`,
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

async function initializeServiceRegistry(): Promise<void> {
	const adapters = getGrpcAdapters();
	const entries: [string, string[]][] = [];

	for (const [svc, adapter] of adapters) {
		try {
			const resources = await adapter.listResources();
			entries.push([svc, resources]);
		} catch (err) {
			throw new Error(
				`Failed to list resources for service "${svc}": ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	entries.push([EVY_CORE_SERVICE, [...EVY_CORE_RESOURCE_NAMES]]);
	setServiceRegistry(entries);
}

let registryInitializationPromise: Promise<void> | null = null;

export async function ensureRegistryInitialized(): Promise<void> {
	if (!registryInitializationPromise) {
		registryInitializationPromise = initializeServiceRegistry().catch((err) => {
			registryInitializationPromise = null;
			throw err;
		});
	}
	await registryInitializationPromise;
}

export async function forwardGet(
	serviceName: string,
	params: ForwardableGetRequest,
): Promise<GetResponse> {
	await ensureRegistryInitialized();
	return getServiceAdapter(serviceName).get(params);
}

export async function forwardCreate(
	serviceName: string,
	params: CreateRequest,
): Promise<CreateResponse> {
	await ensureRegistryInitialized();
	return getServiceAdapter(serviceName).create(params);
}

export async function forwardUpdate(
	serviceName: string,
	params: UpdateRequest,
): Promise<UpdateResponse> {
	await ensureRegistryInitialized();
	return getServiceAdapter(serviceName).update(params);
}

export function wireGrpcEvents(broadcast: BroadcastFn): void {
	for (const adapter of getGrpcAdapters().values()) {
		adapter.onEvent(broadcast);
	}
	// Init registry asynchronously (don't block startup)
	ensureRegistryInitialized().catch((err) => {
		console.error("Failed to initialize service registry:", err);
	});
}
