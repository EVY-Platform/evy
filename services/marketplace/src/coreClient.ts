import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { Client } from "rpc-websockets";

const CORE_WS_CONNECT_TIMEOUT_MS = 5_000;

function getCoreWsUrl(): string {
	const host = process.env.API_WS_HOST ?? "127.0.0.1";
	const port = process.env.API_PORT ?? "8000";
	return `ws://${host}:${port}`;
}

// Connect-on-demand: every call goes through callCoreApi, which connects
// first, so a dropped socket just reconnects on the next call. No background
// reconnect loop is needed — this client holds no event subscriptions.
let client: Client | null = null;
let connectPromise: Promise<void> | null = null;

async function connectClient(): Promise<Client> {
	if (client && connectPromise) {
		await connectPromise;
		return client;
	}

	const wsUrl = getCoreWsUrl();
	const wsClient = new Client(wsUrl, { reconnect: false });
	wsClient.on("close", () => {
		if (client === wsClient) {
			client = null;
			connectPromise = null;
		}
	});

	client = wsClient;
	connectPromise = new Promise<void>((resolve, reject) => {
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

	try {
		await connectPromise;
	} catch (error) {
		if (client === wsClient) {
			client = null;
			connectPromise = null;
		}
		wsClient.close();
		throw error;
	}
	return wsClient;
}

export async function callCoreApi(
	method: string,
	data: unknown,
): Promise<unknown> {
	const wsClient = await connectClient();
	return wsClient.call("api", {
		service: EVY_CORE_SERVICE,
		method,
		data,
	});
}

export function disposeCoreClient(): void {
	connectPromise = null;
	if (client) {
		client.close();
		client = null;
	}
}
