import type {
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import { Client } from "rpc-websockets";
import { listExternalServices } from "../data/data";
import type { EvyDb } from "../database/db";
import { DATA_CHANGED_EVENT } from "../shared/ws";

type BroadcastFn = (eventName: string, payload: unknown) => void;

type ServiceAdapter = {
	get(params: GetRequest): Promise<GetResponse>;
	create(params: CreateRequest): Promise<CreateResponse>;
	update(params: UpdateRequest): Promise<UpdateResponse>;
	delete(params: DeleteRequest): Promise<DeleteResponse>;
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
		onEvent(listener) {
			eventListener = listener;
		},
	};
}

let serviceAdapters: Map<string, ServiceAdapter> | null = null;
let serviceAdapterDb: EvyDb | null = null;
let serviceEventListener: BroadcastFn | null = null;

export function requireServiceWsEndpoint(
	name: string,
	id: string,
): { host: string; port: string } {
	const prefix = name.toUpperCase();
	const host = process.env[`${prefix}_WS_HOST`]?.trim();
	const port = process.env[`${prefix}_WS_PORT`]?.trim();
	if (!host || !port) {
		throw new Error(
			`Service "${name}" (${id}) requires ${prefix}_WS_HOST and ${prefix}_WS_PORT`,
		);
	}
	return { host, port };
}

export async function initServiceAdapters(db: EvyDb): Promise<void> {
	serviceAdapterDb = db;
	const rows = await listExternalServices(db);

	const next = new Map<string, ServiceAdapter>();

	for (const { id, name } of rows) {
		const { host, port } = requireServiceWsEndpoint(name, id);
		const adapter = makeWsAdapter(`ws://${host}:${port}`);
		if (serviceEventListener) {
			adapter.onEvent(serviceEventListener);
		}
		next.set(id, adapter);
	}

	serviceAdapters = next;
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

export async function forwardGet(
	serviceId: string,
	params: GetRequest,
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

export async function forwardDelete(
	serviceId: string,
	params: DeleteRequest,
): Promise<DeleteResponse> {
	return (await getServiceAdapter(serviceId)).delete(params);
}

export function wireServiceEvents(broadcast: BroadcastFn): void {
	serviceEventListener = broadcast;
	for (const adapter of requireAdapters().values()) {
		adapter.onEvent(broadcast);
	}
}
