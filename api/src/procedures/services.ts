import type {
	ApiRequest,
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
	ResourcesResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateResourcesResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import { DATA_CHANGED_EVENT } from "evy-types/ws";
import { Client } from "rpc-websockets";
import { listExternalServices } from "../data/data";
import type { EvyDb } from "../database/db";

type BroadcastFn = (eventName: string, payload: unknown) => void;

type ServiceAdapter = {
	api(params: ApiRequest): Promise<unknown>;
	get(params: GetRequest): Promise<GetResponse>;
	create(params: CreateRequest): Promise<CreateResponse>;
	update(params: UpdateRequest): Promise<UpdateResponse>;
	delete(params: DeleteRequest): Promise<DeleteResponse>;
	resources(): Promise<ResourcesResponse>;
	onEvent(listener: (eventName: string, payload: unknown) => void): void;
};

function makeWsAdapter(wsUrl: string): ServiceAdapter {
	const client = new Client(wsUrl);
	let eventListener: ((eventName: string, payload: unknown) => void) | null =
		null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelayMs = 1000;
	const reconnectMaxDelayMs = 30_000;
	let connected = false;
	let connectPromise: Promise<void> | null = null;

	client.on("close", () => {
		connected = false;
		connectPromise = null;
		scheduleReconnect();
	});

	client.on(DATA_CHANGED_EVENT, (payload: unknown) => {
		eventListener?.(DATA_CHANGED_EVENT, payload);
	});

	function scheduleReconnect(): void {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			reconnectDelayMs = Math.min(
				reconnectDelayMs * 2,
				reconnectMaxDelayMs,
			);
			void connectClient().catch(() => scheduleReconnect());
		}, reconnectDelayMs);
	}

	async function connectClient(): Promise<void> {
		if (connected) return;
		if (connectPromise) return connectPromise;

		connectPromise = (async () => {
			await new Promise<void>((resolve, reject) => {
				const onOpen = () => {
					client.removeListener("error", onError);
					resolve();
				};
				const onError = (err: Error) => {
					client.removeListener("open", onOpen);
					reject(err);
				};
				client.on("open", onOpen);
				client.on("error", onError);
			});
			connected = true;
			reconnectDelayMs = 1000;
			await client.subscribe(DATA_CHANGED_EVENT);
		})();

		try {
			await connectPromise;
		} catch (error) {
			connectPromise = null;
			throw error;
		}
	}

	async function callMethod<T>(
		method: string,
		params: unknown,
		validate: (parsed: unknown) => T,
	): Promise<T> {
		await connectClient();
		const result = await client.call(method, params);
		return validate(result);
	}

	void connectClient().catch(() => scheduleReconnect());

	return {
		// A service's procedure responses have no shared schema - the registry
		// names the response schema, and validating it is the caller's job.
		api: (params) => callMethod("api", params, (parsed) => parsed),
		get: (params) =>
			callMethod("get", params, (parsed) => validateGetResponse(parsed)),
		create: (params) =>
			callMethod("create", params, (parsed) =>
				validateCreateResponse(parsed),
			),
		update: (params) =>
			callMethod("update", params, (parsed) =>
				validateUpdateResponse(parsed),
			),
		delete: (params) =>
			callMethod("delete", params, (parsed) =>
				validateDeleteResponse(parsed),
			),
		resources: () =>
			callMethod("resources", {}, (parsed) =>
				validateResourcesResponse(parsed),
			),
		onEvent(listener) {
			eventListener = listener;
		},
	};
}

let serviceAdapters: Map<string, ServiceAdapter> | null = null;
let serviceNames: Map<string, string> = new Map();
let serviceAdapterDb: EvyDb | null = null;
let serviceBroadcast: BroadcastFn | null = null;

/** Env var names are derived from the service name, so it must be usable as one. */
const ENV_SAFE_SERVICE_NAME = /^[A-Z][A-Z0-9_]*$/;

const DEFAULT_SERVICE_RPC_TIMEOUT_MS = 10_000;

function serviceRpcTimeoutMs(): number {
	const configured = Number(process.env.SERVICE_RPC_TIMEOUT_MS);
	return Number.isFinite(configured) && configured > 0
		? configured
		: DEFAULT_SERVICE_RPC_TIMEOUT_MS;
}

/**
 * Endpoint comes from the service row first and the `<NAME>_WS_HOST/PORT` env
 * convention second. The row keeps registration in data where the rest of
 * service routing already lives; the env fallback keeps existing deployments
 * (and Docker Compose) working unchanged.
 */
export function resolveServiceWsEndpoint(svc: {
	id: string;
	name: string;
	wsHost?: string | null;
	wsPort?: number | null;
}): { host: string; port: string } {
	const rowHost = svc.wsHost?.trim();
	const rowPort = svc.wsPort;
	if (rowHost && rowPort) {
		return { host: rowHost, port: String(rowPort) };
	}

	const prefix = svc.name.toUpperCase();
	if (!ENV_SAFE_SERVICE_NAME.test(prefix)) {
		throw new Error(
			`Service "${svc.name}" (${svc.id}) has no wsHost/wsPort and its name ` +
				"cannot be used for env lookup (expected letters, digits and underscores)",
		);
	}

	const host = process.env[`${prefix}_WS_HOST`]?.trim();
	const port = process.env[`${prefix}_WS_PORT`]?.trim();
	if (!host || !port) {
		throw new Error(
			`Service "${svc.name}" (${svc.id}) requires wsHost/wsPort on its row, ` +
				`or ${prefix}_WS_HOST and ${prefix}_WS_PORT`,
		);
	}
	return { host, port };
}

/** Carries which service failed so the client is not left guessing. */
export class ServiceForwardError extends Error {
	readonly data: { serviceId: string; serviceName: string; code: string };

	constructor(
		message: string,
		data: { serviceId: string; serviceName: string; code: string },
	) {
		super(message);
		this.name = "ServiceForwardError";
		this.data = data;
	}
}

async function withTimeout<T>(
	work: Promise<T>,
	timeoutMs: number,
	onTimeout: () => Error,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			work,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(() => reject(onTimeout()), timeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export async function initServiceAdapters(
	db: EvyDb,
	broadcast: BroadcastFn | null = null,
): Promise<void> {
	serviceAdapterDb = db;
	if (broadcast) {
		serviceBroadcast = broadcast;
	}
	const rows = await listExternalServices(db);

	const next = new Map<string, ServiceAdapter>();
	const names = new Map<string, string>();

	for (const row of rows) {
		const { host, port } = resolveServiceWsEndpoint(row);
		const adapter = makeWsAdapter(`ws://${host}:${port}`);
		if (serviceBroadcast) {
			adapter.onEvent(serviceBroadcast);
		}
		next.set(row.id, adapter);
		names.set(row.id, row.name);
	}

	serviceAdapters = next;
	serviceNames = names;
}

/**
 * Every forwarded call goes through here so a hung or failing service surfaces
 * as an attributed, time-bounded error instead of an anonymous stall.
 */
async function forwardTo<T>(
	serviceId: string,
	operation: string,
	call: (adapter: ServiceAdapter) => Promise<T>,
): Promise<T> {
	const adapter = await getServiceAdapter(serviceId);
	const serviceName = serviceNames.get(serviceId) ?? "unknown";
	const timeoutMs = serviceRpcTimeoutMs();

	try {
		return await withTimeout(
			call(adapter),
			timeoutMs,
			() =>
				new ServiceForwardError(
					`Service "${serviceName}" (${serviceId}) timed out after ${timeoutMs}ms on ${operation}`,
					{ serviceId, serviceName, code: "SERVICE_TIMEOUT" },
				),
		);
	} catch (error) {
		if (error instanceof ServiceForwardError) throw error;
		const detail = error instanceof Error ? error.message : String(error);
		throw new ServiceForwardError(
			`Service "${serviceName}" (${serviceId}) failed on ${operation}: ${detail}`,
			{ serviceId, serviceName, code: "SERVICE_ERROR" },
		);
	}
}

function requireAdapters(): Map<string, ServiceAdapter> {
	if (!serviceAdapters) {
		throw new Error(
			"Service adapters not initialised. Call initServiceAdapters() first.",
		);
	}
	return serviceAdapters;
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

export async function forwardApi(
	serviceId: string,
	params: ApiRequest,
): Promise<unknown> {
	return forwardTo(serviceId, `api:${params.method}`, (adapter) =>
		adapter.api(params),
	);
}

export async function forwardGet(
	serviceId: string,
	params: GetRequest,
): Promise<GetResponse> {
	return forwardTo(serviceId, "get", (adapter) => adapter.get(params));
}

export async function forwardCreate(
	serviceId: string,
	params: CreateRequest,
): Promise<CreateResponse> {
	return forwardTo(serviceId, "create", (adapter) => adapter.create(params));
}

export async function forwardUpdate(
	serviceId: string,
	params: UpdateRequest,
): Promise<UpdateResponse> {
	return forwardTo(serviceId, "update", (adapter) => adapter.update(params));
}

export async function forwardDelete(
	serviceId: string,
	params: DeleteRequest,
): Promise<DeleteResponse> {
	return forwardTo(serviceId, "delete", (adapter) => adapter.delete(params));
}

export async function forwardResources(
	serviceId: string,
): Promise<ResourcesResponse> {
	return forwardTo(serviceId, "resources", (adapter) => adapter.resources());
}
