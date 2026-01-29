import { Client } from "rpc-websockets";
import type { ServerFlow } from "../types";
import { config } from "../config";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type SaveFlowResponse = {
	id: string;
	data: ServerFlow;
	createdAt: string;
	updatedAt: string;
};

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

		return (await this.client.call("getSDUI", {})) as ServerFlow[];
	}

	async saveFlow(flowData: ServerFlow): Promise<ServerFlow> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const result = (await this.client.call("saveFlow", {
			flowData,
			flowId: flowData.id,
		})) as SaveFlowResponse;
		return result.data;
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
