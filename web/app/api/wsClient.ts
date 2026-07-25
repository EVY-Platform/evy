import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	SyncResponse,
} from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { DATA_CHANGED_EVENT, type DataChangedNotification } from "evy-types/ws";
import { Client } from "rpc-websockets";
import { config } from "../config";
import type { FlowEntityCollections } from "../utils/flowEntities";

type FlatResourceName =
	| typeof EVY_CORE_RESOURCE.FLOWS
	| typeof EVY_CORE_RESOURCE.PAGES
	| typeof EVY_CORE_RESOURCE.ROWS;
type FlatResourceRecord = DATA_EVY_Flow | DATA_EVY_Page | DATA_EVY_Row;

function isFlatWriteResponse(value: unknown): value is FlatResourceRecord {
	return (
		value !== null &&
		typeof value === "object" &&
		"id" in value &&
		"createdAt" in value &&
		"updatedAt" in value &&
		typeof value.id === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string"
	);
}

function comparableRecord(record: FlatResourceRecord): string {
	const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = record;
	return JSON.stringify(rest);
}

function recordsById<T extends FlatResourceRecord>(
	records: T[],
): Map<string, T> {
	return new Map(records.map((record) => [record.id, record]));
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type DataChangedListener = (notification: DataChangedNotification) => void;

class WSClient {
	private client: Client | null = null;
	private connectionState: ConnectionState = "disconnected";
	private connectionPromise: Promise<void> | null = null;
	private dataChangedListeners = new Set<DataChangedListener>();

	/**
	 * Subscribe to server pushes. Without this the builder only ever saw the
	 * snapshot it loaded at mount, so two people editing the same flow
	 * overwrote each other silently.
	 */
	onDataChanged(listener: DataChangedListener): () => void {
		this.dataChangedListeners.add(listener);
		return () => this.dataChangedListeners.delete(listener);
	}

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
					await this.client?.subscribe(DATA_CHANGED_EVENT);
					this.connectionState = "connected";
					resolve();
				} catch (error) {
					this.connectionState = "error";
					reject(error);
				}
			});

			this.client.on(DATA_CHANGED_EVENT, (payload: unknown) => {
				const notification = payload as DataChangedNotification;
				if (!notification || typeof notification !== "object") return;
				for (const listener of this.dataChangedListeners) {
					listener(notification);
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

	async sync(cursor?: string): Promise<SyncResponse> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const rawUnknown: unknown = await this.client.call(
			"sync",
			cursor ? { cursor } : {},
		);

		const response = rawUnknown as SyncResponse;
		if (
			!response ||
			typeof response !== "object" ||
			!("data" in response)
		) {
			throw new Error("Invalid sync response shape");
		}

		return response;
	}

	async saveFlowGraph(
		previousGraph: FlowEntityCollections,
		nextGraph: FlowEntityCollections,
	): Promise<FlowEntityCollections> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		await this.writeChangedRecords(
			EVY_CORE_RESOURCE.ROWS,
			previousGraph.rows,
			nextGraph.rows,
		);
		await this.writeChangedRecords(
			EVY_CORE_RESOURCE.PAGES,
			previousGraph.pages,
			nextGraph.pages,
		);
		await this.writeChangedRecords(
			EVY_CORE_RESOURCE.FLOWS,
			previousGraph.flows,
			nextGraph.flows,
		);
		await this.deleteMissingRecords(
			EVY_CORE_RESOURCE.PAGES,
			previousGraph.pages,
			nextGraph.pages,
		);
		await this.deleteMissingRecords(
			EVY_CORE_RESOURCE.ROWS,
			previousGraph.rows,
			nextGraph.rows,
		);

		return nextGraph;
	}

	private async writeChangedRecords<T extends FlatResourceRecord>(
		resource: FlatResourceName,
		previousRecords: T[],
		nextRecords: T[],
	): Promise<void> {
		const previousRecordsById = recordsById(previousRecords);
		for (const nextRecord of nextRecords) {
			const previousRecord = previousRecordsById.get(nextRecord.id);
			if (
				previousRecord &&
				comparableRecord(previousRecord) ===
					comparableRecord(nextRecord)
			) {
				continue;
			}
			await this.writeRecord(
				resource,
				previousRecord ? "update" : "create",
				nextRecord,
			);
		}
	}

	private async deleteMissingRecords<T extends FlatResourceRecord>(
		resource: FlatResourceName,
		previousRecords: T[],
		nextRecords: T[],
	): Promise<void> {
		const nextRecordIds = new Set(nextRecords.map((record) => record.id));
		for (const previousRecord of previousRecords) {
			if (!nextRecordIds.has(previousRecord.id)) {
				await this.deleteRecord(resource, previousRecord.id);
			}
		}
	}

	private async writeRecord(
		resource: FlatResourceName,
		method: "create" | "update",
		record: FlatResourceRecord,
	): Promise<void> {
		if (!this.client) throw new Error("WebSocket client not initialized");
		const raw = await this.client.call(method, {
			service: EVY_CORE_SERVICE,
			resource,
			filter: { id: record.id },
			data: record,
		});
		if (!isFlatWriteResponse(raw)) {
			throw new Error(`Invalid ${resource} write response`);
		}
	}

	private async deleteRecord(
		resource: FlatResourceName,
		id: string,
	): Promise<void> {
		if (!this.client) throw new Error("WebSocket client not initialized");
		const raw = await this.client.call("delete", {
			service: EVY_CORE_SERVICE,
			resource,
			filter: { id },
		});
		if (!isFlatWriteResponse(raw)) {
			throw new Error(`Invalid ${resource} delete response`);
		}
	}
}

export const wsClient = new WSClient();
