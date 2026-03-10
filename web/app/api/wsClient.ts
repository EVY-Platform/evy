import { Client } from "rpc-websockets";
import type { SDUI_Flow as ServerFlow } from "evy-types/sdui/evy";
import type { UpsertResponse } from "evy-types/rpc/upsert.response";
import { config } from "../config";

function isServerFlow(v: unknown): v is ServerFlow {
	return (
		v !== null &&
		typeof v === "object" &&
		"id" in v &&
		"name" in v &&
		"type" in v &&
		"data" in v &&
		"pages" in v
	);
}

function isServerFlowArray(v: unknown): v is ServerFlow[] {
	if (!Array.isArray(v)) return false;
	return v.every(isServerFlow);
}

function isUpsertResponse(v: unknown): v is UpsertResponse {
	return (
		v !== null &&
		typeof v === "object" &&
		"id" in v &&
		"data" in v &&
		"createdAt" in v &&
		"updatedAt" in v
	);
}

function isFlowUpsertResponse(
	v: unknown,
): v is { id: string; data: ServerFlow; createdAt: string; updatedAt: string } {
	return isUpsertResponse(v) && isServerFlow(v.data);
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

			this.client.on("error", (error) => {
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

	async getSDUI(): Promise<ServerFlow[]> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const raw = await this.client.call("get", {
			namespace: "evy",
			resource: "sdui",
		});
		if (!isServerFlowArray(raw)) {
			throw new Error("Invalid get response: expected array of flows");
		}
		return raw;
	}

	async updateSDUI(flowData: ServerFlow): Promise<ServerFlow> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const raw = await this.client.call("upsert", {
			namespace: "evy",
			resource: "sdui",
			filter: flowData.id ? { id: flowData.id } : undefined,
			data: flowData,
		});
		if (!isFlowUpsertResponse(raw)) {
			throw new Error("Invalid upsert response: expected flow");
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
