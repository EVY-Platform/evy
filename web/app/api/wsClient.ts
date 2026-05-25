import { Client } from "rpc-websockets";
import type {
	CreateResponse,
	SyncResponse,
	UI_Flow as ServerFlow,
	UpdateResponse,
} from "evy-types";
import { config } from "../config";

function isServerFlow(v: unknown): v is ServerFlow {
	return (
		v !== null &&
		typeof v === "object" &&
		"id" in v &&
		"name" in v &&
		typeof v.id === "string" &&
		typeof v.name === "string" &&
		"pages" in v &&
		Array.isArray(v.pages)
	);
}

function isWriteResponseEnvelope(
	value: unknown,
): value is CreateResponse | UpdateResponse {
	return (
		value !== null &&
		typeof value === "object" &&
		"metadata" in value &&
		"data" in value &&
		value.data !== null &&
		typeof value.data === "object"
	);
}

function isFlowWriteResponse(value: unknown): value is {
	metadata: unknown;
	data: { id: string; data: ServerFlow; createdAt: string; updatedAt: string };
} {
	if (!isWriteResponseEnvelope(value)) return false;
	const inner = value.data;
	return (
		inner !== null &&
		typeof inner === "object" &&
		"id" in inner &&
		"data" in inner &&
		"createdAt" in inner &&
		"updatedAt" in inner &&
		typeof inner.id === "string" &&
		typeof inner.createdAt === "string" &&
		typeof inner.updatedAt === "string" &&
		isServerFlow(inner.data)
	);
}

function isGetResponseEnvelope(value: unknown): value is { data: unknown[] } {
	return (
		value !== null &&
		typeof value === "object" &&
		"data" in value &&
		Array.isArray(value.data)
	);
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

class WSClient {
	private client: Client | null = null;
	private connectionState: ConnectionState = "disconnected";
	private connectionPromise: Promise<void> | null = null;

	async connect(): Promise<void> {
		if (this.connectionState === "connected") return;
		if (this.connectionPromise) return this.connectionPromise;

		this.connectionState = "connecting";

		this.connectionPromise = new Promise((resolve, reject) => {
			this.client = new Client(config.apiUrl);

			this.client.on("open", async () => {
				try {
					const token = crypto.randomUUID();
					await this.client?.login({ token, os: "Web" });
					this.connectionState = "connected";
					resolve();
				} catch (error) {
					this.connectionState = "error";
					reject(error);
				}
			});

			this.client.on("error", (error: Error) => {
				this.connectionState = "error";
				this.connectionPromise = null;
				reject(error);
			});

			this.client.on("close", () => {
				this.connectionState = "disconnected";
				this.connectionPromise = null;
			});
		});

		return this.connectionPromise;
	}

	async sync(lastSyncTime = "1970-01-01T00:00:00.000Z"): Promise<SyncResponse> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const rawUnknown: unknown = await this.client.call("sync", {
			lastSyncTime,
		});

		const response = rawUnknown as SyncResponse;
		if (!response || typeof response !== "object" || !("data" in response)) {
			throw new Error("Invalid sync response shape");
		}

		return response;
	}

	private async flowExists(flowId: string): Promise<boolean> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const raw = await this.client.call("get", {
			service: "evy",
			resource: "sdui",
			filter: { id: flowId },
		});
		return isGetResponseEnvelope(raw) && raw.data.some(isServerFlow);
	}

	async updateSDUI(flowData: ServerFlow): Promise<ServerFlow> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const shouldUpdate = flowData.id
			? await this.flowExists(flowData.id)
			: false;
		const raw = await this.client.call(shouldUpdate ? "update" : "create", {
			service: "evy",
			resource: "sdui",
			filter: flowData.id ? { id: flowData.id } : undefined,
			data: flowData,
		});
		if (!isFlowWriteResponse(raw)) {
			throw new Error("Invalid write response: expected flow");
		}
		return raw.data.data;
	}

	disconnect(): void {
		if (this.client) {
			this.client.close();
			this.client = null;
		}
		this.connectionState = "disconnected";
		this.connectionPromise = null;
	}

	getState(): ConnectionState {
		return this.connectionState;
	}
}

export const wsClient = new WSClient();
