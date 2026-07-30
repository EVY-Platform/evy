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
	dispose(): void;
};

const SERVICE_WS_CONNECT_TIMEOUT_MS = 5_000;

function makeWsAdapter(wsUrl: string): ServiceAdapter {
	// Own reconnect so a clean server shutdown (close code 1000) still comes
	// back — the library's built-in reconnect skips that code and caps attempts.
	const client = new Client(wsUrl, { reconnect: false });
	let eventListener: ((eventName: string, payload: unknown) => void) | null =
		null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelayMs = 1000;
	const reconnectMaxDelayMs = 30_000;
	let connected = false;
	let disposed = false;
	let connectPromise: Promise<void> | null = null;

	client.on("close", () => {
		connected = false;
		connectPromise = null;
		if (!disposed) scheduleReconnect();
	});

	client.on(DATA_CHANGED_EVENT, (payload: unknown) => {
		eventListener?.(DATA_CHANGED_EVENT, payload);
	});

	function scheduleReconnect(): void {
		if (disposed || reconnectTimer) return;
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
		if (disposed) {
			throw new Error(`Service WebSocket adapter disposed (${wsUrl})`);
		}
		if (connected) return;
		if (connectPromise) return connectPromise;

		connectPromise = (async () => {
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					client.removeListener("open", onOpen);
					client.removeListener("error", onError);
					reject(
						new Error(
							`WebSocket connection timeout to ${wsUrl} after ${SERVICE_WS_CONNECT_TIMEOUT_MS}ms`,
						),
					);
				}, SERVICE_WS_CONNECT_TIMEOUT_MS);

				const onOpen = () => {
					clearTimeout(timeout);
					client.removeListener("error", onError);
					resolve();
				};
				const onError = (err: Error) => {
					clearTimeout(timeout);
					client.removeListener("open", onOpen);
					reject(err);
				};
				client.on("open", onOpen);
				client.on("error", onError);
				// After close the library clears its socket; connect() is a
				// no-op while one still exists (including an in-flight open).
				client.connect();
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
		dispose() {
			disposed = true;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			connected = false;
			connectPromise = null;
			client.close();
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
	ws_host?: string | null;
	ws_port?: number | null;
}): { host: string; port: string } {
	const rowHost = svc.ws_host?.trim();
	const rowPort = svc.ws_port;
	if (rowHost && rowPort) {
		return { host: rowHost, port: String(rowPort) };
	}

	const prefix = svc.name.toUpperCase();
	if (!ENV_SAFE_SERVICE_NAME.test(prefix)) {
		throw new Error(
			`Service "${svc.name}" (${svc.id}) has no ws_host/ws_port and its name ` +
				"cannot be used for env lookup (expected letters, digits and underscores)",
		);
	}

	const host = process.env[`${prefix}_WS_HOST`]?.trim();
	const port = process.env[`${prefix}_WS_PORT`]?.trim();
	if (!host || !port) {
		throw new Error(
			`Service "${svc.name}" (${svc.id}) requires ws_host/ws_port on its row, ` +
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

function disposeAdapterMap(adapters: Map<string, ServiceAdapter> | null): void {
	if (!adapters) return;
	for (const adapter of adapters.values()) {
		adapter.dispose();
	}
}

export function disposeServiceAdapters(): void {
	disposeAdapterMap(serviceAdapters);
	serviceAdapters = null;
	serviceNames = new Map();
	serviceAdapterDb = null;
	serviceBroadcast = null;
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

	const previous = serviceAdapters;
	serviceAdapters = next;
	serviceNames = names;
	disposeAdapterMap(previous);
}

/**
 * Explains why a service rejected a call.
 *
 * Services validate their own payloads, so the reason they give is the only
 * explanation the caller gets. It does not arrive as an Error: crossing the WS
 * hop leaves a plain JSON-RPC error object, and stringifying that yields
 * "[object Object]" — the reason, silently discarded.
 */
function describeServiceFailure(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null) {
		const { message, data } = error as {
			message?: unknown;
			data?: unknown;
		};
		// rpc-websockets puts the thrown Error's name in `message` and its own
		// message in `data`, so the useful half is usually `data`.
		const parts = [message, data].filter(
			(part): part is string =>
				typeof part === "string" && part.length > 0,
		);
		if (parts.length > 0) return parts.join(": ");
		try {
			return JSON.stringify(error);
		} catch {
			// Fall through to String() for anything JSON cannot represent.
		}
	}
	return String(error);
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
		throw new ServiceForwardError(
			`Service "${serviceName}" (${serviceId}) failed on ${operation}: ${describeServiceFailure(error)}`,
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
