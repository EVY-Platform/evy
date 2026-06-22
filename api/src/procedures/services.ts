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

import { ne } from "drizzle-orm";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	validateGetResponse,
	validateCreateResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import { service } from "../../../types/generated/ts/db/schema.generated";
import type { EvyDb } from "../database/db";

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
		onEvent(listener) {
			eventListener = listener;
			startSubscribeStream();
		},
	};
}

let grpcAdapters: Map<string, ServiceAdapter> | null = null;
let serviceAdapterDb: EvyDb | null = null;
let grpcEventListener: ((eventName: string, payload: unknown) => void) | null =
	null;

/**
 * Resolve the gRPC host/port for a registered service from the environment.
 * Each non-core service must have {NAME}_GRPC_HOST and {NAME}_GRPC_PORT set,
 * where NAME is the service's `name` field (uppercased).
 */
export function requireServiceGrpcEndpoint(
	name: string,
	id: string,
): { host: string; port: string } {
	const prefix = name.toUpperCase();
	const host = process.env[`${prefix}_GRPC_HOST`]?.trim();
	const port = process.env[`${prefix}_GRPC_PORT`]?.trim();
	if (!host || !port) {
		throw new Error(
			`Service "${name}" (${id}) requires ${prefix}_GRPC_HOST and ${prefix}_GRPC_PORT`,
		);
	}
	return { host, port };
}

/**
 * Initialise gRPC adapters from the service registry in the database.
 * Must be called once at startup before any request is forwarded.
 */
export async function initServiceAdapters(db: EvyDb): Promise<void> {
	serviceAdapterDb = db;
	const rows = await db
		.select({ id: service.id, name: service.name })
		.from(service)
		.where(ne(service.id, EVY_CORE_SERVICE));

	const next = new Map<string, ServiceAdapter>();
	const ServiceCtor = loadEvyServiceConstructor();

	for (const { id, name } of rows) {
		const { host, port } = requireServiceGrpcEndpoint(name, id);
		const adapter = makeGrpcAdapter(name, `${host}:${port}`, ServiceCtor);
		if (grpcEventListener) {
			adapter.onEvent(grpcEventListener);
		}
		next.set(id, adapter);
	}

	grpcAdapters = next;
}

function requireAdapters(): Map<string, ServiceAdapter> {
	if (!grpcAdapters) {
		throw new Error(
			"Service adapters not initialised. Call initServiceAdapters() first.",
		);
	}
	return grpcAdapters;
}

async function getServiceAdapter(serviceId: string): Promise<ServiceAdapter> {
	let adapter = requireAdapters().get(serviceId);
	if (!adapter && serviceAdapterDb) {
		await initServiceAdapters(serviceAdapterDb);
		adapter = requireAdapters().get(serviceId);
	}
	if (!adapter) {
		throw new Error(`No service registered for service ${serviceId}`);
	}
	return adapter;
}

export async function forwardGet(
	serviceId: string,
	params: ForwardableGetRequest,
): Promise<GetResponse> {
	return (await getServiceAdapter(serviceId)).get(params);
}

export async function forwardCreate(
	serviceId: string,
	params: CreateRequest,
): Promise<CreateResponse> {
	return (await getServiceAdapter(serviceId)).create(params);
}

export async function forwardUpdate(
	serviceId: string,
	params: UpdateRequest,
): Promise<UpdateResponse> {
	return (await getServiceAdapter(serviceId)).update(params);
}

export function wireGrpcEvents(broadcast: BroadcastFn): void {
	grpcEventListener = broadcast;
	for (const adapter of requireAdapters().values()) {
		adapter.onEvent(broadcast);
	}
}
