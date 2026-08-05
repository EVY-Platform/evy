import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { Client } from "rpc-websockets";

const CORE_WS_CONNECT_TIMEOUT_MS = 5_000;

function getCoreWsUrl(): string {
	const host = process.env.API_WS_HOST ?? "127.0.0.1";
	const port = process.env.API_PORT ?? "8000";
	return `ws://${host}:${port}`;
}

let client: Client | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs = 1_000;
const reconnectMaxDelayMs = 30_000;
let connected = false;
let disposed = false;
let connectPromise: Promise<void> | null = null;

function scheduleReconnect(): void {
	if (disposed || reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		reconnectDelayMs = Math.min(reconnectDelayMs * 2, reconnectMaxDelayMs);
		void connectClient().catch(() => scheduleReconnect());
	}, reconnectDelayMs);
}

function getClient(): Client {
	if (!client) {
		const wsUrl = getCoreWsUrl();
		client = new Client(wsUrl, { reconnect: false });
		client.on("close", () => {
			connected = false;
			connectPromise = null;
			if (!disposed) scheduleReconnect();
		});
	}
	return client;
}

async function connectClient(): Promise<void> {
	if (disposed) {
		throw new Error("Core WebSocket client disposed");
	}
	if (connected) return;
	if (connectPromise) return connectPromise;

	const wsClient = getClient();
	const wsUrl = getCoreWsUrl();

	connectPromise = (async () => {
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				wsClient.removeListener("open", onOpen);
				wsClient.removeListener("error", onError);
				reject(
					new Error(
						`WebSocket connection timeout to ${wsUrl} after ${CORE_WS_CONNECT_TIMEOUT_MS}ms`,
					),
				);
			}, CORE_WS_CONNECT_TIMEOUT_MS);

			const onOpen = () => {
				clearTimeout(timeout);
				wsClient.removeListener("error", onError);
				resolve();
			};
			const onError = (err: Error) => {
				clearTimeout(timeout);
				wsClient.removeListener("open", onOpen);
				reject(err);
			};
			wsClient.on("open", onOpen);
			wsClient.on("error", onError);
			wsClient.connect();
		});
		connected = true;
		reconnectDelayMs = 1_000;
	})();

	try {
		await connectPromise;
	} catch (error) {
		connectPromise = null;
		throw error;
	}
}

export async function callCoreApi(
	method: string,
	data: unknown,
): Promise<unknown> {
	await connectClient();
	return getClient().call("api", {
		service: EVY_CORE_SERVICE,
		method,
		data,
	});
}

export function disposeCoreClient(): void {
	disposed = true;
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	connected = false;
	connectPromise = null;
	if (client) {
		client.close();
		client = null;
	}
}
