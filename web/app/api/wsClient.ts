import { Client } from "rpc-websockets";
import type { SyncResponse, UI_Flow as ServerFlow } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { config } from "../config";

export function isServerFlow(v: unknown): v is ServerFlow {
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

function isFlowWriteResponse(value: unknown): value is {
	id: string;
	data: ServerFlow;
	createdAt: string;
	updatedAt: string;
} {
	return (
		value !== null &&
		typeof value === "object" &&
		"id" in value &&
		"data" in value &&
		"createdAt" in value &&
		"updatedAt" in value &&
		typeof value.id === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		isServerFlow(value.data)
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

	async sync(lastSyncTime: string): Promise<SyncResponse> {
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
			service: EVY_CORE_SERVICE,
			resource: "sdui",
			filter: { id: flowId },
		});
		return Array.isArray(raw) && raw.some(isServerFlow);
	}

	async updateSDUI(flowData: ServerFlow): Promise<ServerFlow> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const shouldUpdate = flowData.id
			? await this.flowExists(flowData.id)
			: false;
		const raw = await this.client.call(shouldUpdate ? "update" : "create", {
			service: EVY_CORE_SERVICE,
			resource: "sdui",
			filter: flowData.id ? { id: flowData.id } : undefined,
			data: flowData,
		});
		if (!isFlowWriteResponse(raw)) {
			throw new Error("Invalid write response: expected flow");
		}
		return raw.data;
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
