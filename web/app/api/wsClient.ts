import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	ResourcesResponse,
	SyncResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { assertFlatFlowGraphSubmits } from "evy-types/flowSubmits";
import {
	DATA_CHANGED_EVENT,
	type DataChangedNotification,
	type DataChangedOperation,
} from "evy-types/ws";
import { Client } from "rpc-websockets";
import { config } from "../config";
import type { FlowEntityCollections } from "../utils/flowEntities";
import { collectionsToMaps } from "../utils/flowEntities";

type FlatResourceRef =
	| typeof EVY_CORE_RESOURCE_REF.FLOWS
	| typeof EVY_CORE_RESOURCE_REF.PAGES
	| typeof EVY_CORE_RESOURCE_REF.ROWS;
type FlatResourceRecord = DATA_EVY_Flow | DATA_EVY_Page | DATA_EVY_Row;

function isFlatWriteResponse(value: unknown): value is FlatResourceRecord {
	return (
		value !== null &&
		typeof value === "object" &&
		"id" in value &&
		"created_at" in value &&
		"updated_at" in value &&
		typeof value.id === "string" &&
		typeof value.created_at === "string" &&
		typeof value.updated_at === "string"
	);
}

function versionKey(resource: string, id: string): string {
	return `${resource}:${id}`;
}

/**
 * Raised when the server rejects a write because the record moved on.
 *
 * Distinguishable from a transport failure so the UI can say the right thing:
 * retrying will not help, the editor has to see the other change first.
 */
export class SaveConflictError extends Error {
	readonly resource: string;
	readonly recordId: string;

	constructor(resource: string, recordId: string, detail: string) {
		super(
			`Someone else changed this ${resource.replace(/s$/, "")} while you were editing it. ${detail}`,
		);
		this.name = "SaveConflictError";
		this.resource = resource;
		this.recordId = recordId;
	}
}

function isConflictResponse(error: unknown): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "object" && error !== null && "message" in error
				? String((error as { message: unknown }).message)
				: String(error);
	return message.includes("Conflict:") || message.includes("ConflictError");
}

function comparableRecord(record: FlatResourceRecord): string {
	const {
		created_at: _created_at,
		updated_at: _updated_at,
		...rest
	} = record;
	return JSON.stringify(rest);
}

function recordsById<T extends FlatResourceRecord>(
	records: T[],
): Map<string, T> {
	return new Map(records.map((record) => [record.id, record]));
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

/**
 * A record carried by a `dataChanged` push, after validation.
 *
 * The protocol's `value` is `unknown` and may be one record or an array, so it
 * is normalized once here rather than at each subscriber - the transport and
 * the UI reading the same payload two different ways is how the version map
 * silently stopped being updated.
 */
export interface RemoteRecord {
	id: string;
	updated_at?: string;
	deleted_at?: string;
}

export interface RemoteChange {
	resource: string;
	operation: DataChangedOperation;
	record: RemoteRecord;
}

type DataChangedListener = (changes: RemoteChange[]) => void;

function normalizeRemoteChanges(
	notification: DataChangedNotification,
): RemoteChange[] {
	if (!notification.resource.startsWith(`${EVY_CORE_SERVICE}.`)) return [];
	const values = Array.isArray(notification.value)
		? notification.value
		: [notification.value];

	const changes: RemoteChange[] = [];
	for (const value of values) {
		if (!value || typeof value !== "object") continue;
		if (typeof (value as Record<string, unknown>).id !== "string") continue;
		changes.push({
			resource: notification.resource,
			operation: notification.operation,
			record: value as RemoteRecord,
		});
	}
	return changes;
}

class WSClient {
	private client: Client | null = null;
	private connectionState: ConnectionState = "disconnected";
	private connectionPromise: Promise<void> | null = null;
	private dataChangedListeners = new Set<DataChangedListener>();
	/**
	 * The `updated_at` the server last told us each record has.
	 *
	 * Kept here rather than in app state because it is transport bookkeeping:
	 * app state carries client-stamped timestamps from local edits, which are
	 * not versions the server would recognise. Fed from sync, from every write
	 * response, and from remote pushes - so the precondition means "no change I
	 * have not already seen".
	 */
	private serverVersions = new Map<string, string>();
	/** Tail of the save chain; see `saveFlowGraph`. */
	private saveQueue: Promise<void> = Promise.resolve();

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
					await this.client?.login({ token, os: "web" });
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
				const changes = normalizeRemoteChanges(notification);
				if (changes.length === 0) return;
				for (const change of changes) {
					this.rememberRemoteVersion(change);
				}
				for (const listener of this.dataChangedListeners) {
					listener(changes);
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

		this.rememberVersionsFromSync(response);
		return response;
	}

	async resources(): Promise<ResourcesResponse> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const rawUnknown: unknown = await this.client.call("resources", {});

		const response = rawUnknown as ResourcesResponse;
		if (
			!response ||
			typeof response !== "object" ||
			!Array.isArray(response.services)
		) {
			throw new Error("Invalid resources response shape");
		}

		return response;
	}

	/**
	 * Saves run strictly one at a time.
	 *
	 * Autosave fires per state change, so two passes can overlap - and with an
	 * optimistic lock that is fatal rather than merely wasteful: both read the
	 * version map before the first response updates it, send the same
	 * precondition, and the second write is rejected as a conflict with its own
	 * predecessor. Editing a field fast enough to produce two passes reported
	 * "someone else changed this".
	 */
	saveFlowGraph(
		previousGraph: FlowEntityCollections,
		nextGraph: FlowEntityCollections,
	): Promise<FlowEntityCollections> {
		const run = this.saveQueue.then(
			() => this.saveFlowGraphNow(previousGraph, nextGraph),
			() => this.saveFlowGraphNow(previousGraph, nextGraph),
		);
		// The queue must survive a rejected save, or one failure wedges every
		// later one; callers still see the rejection through `run`.
		this.saveQueue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private async saveFlowGraphNow(
		previousGraph: FlowEntityCollections,
		nextGraph: FlowEntityCollections,
	): Promise<FlowEntityCollections> {
		await this.connect();
		if (!this.client) throw new Error("WebSocket client not initialized");

		const maps = collectionsToMaps(nextGraph);
		assertFlatFlowGraphSubmits(
			nextGraph.flows,
			maps.pagesById,
			maps.rowsById,
		);

		await this.writeChangedRecords(
			EVY_CORE_RESOURCE_REF.ROWS,
			previousGraph.rows,
			nextGraph.rows,
		);
		await this.writeChangedRecords(
			EVY_CORE_RESOURCE_REF.PAGES,
			previousGraph.pages,
			nextGraph.pages,
		);
		await this.writeChangedRecords(
			EVY_CORE_RESOURCE_REF.FLOWS,
			previousGraph.flows,
			nextGraph.flows,
		);
		await this.deleteMissingRecords(
			EVY_CORE_RESOURCE_REF.PAGES,
			previousGraph.pages,
			nextGraph.pages,
		);
		await this.deleteMissingRecords(
			EVY_CORE_RESOURCE_REF.ROWS,
			previousGraph.rows,
			nextGraph.rows,
		);

		return nextGraph;
	}

	private async writeChangedRecords<T extends FlatResourceRecord>(
		resource: FlatResourceRef,
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
		resource: FlatResourceRef,
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
		resource: FlatResourceRef,
		method: "create" | "update",
		record: FlatResourceRecord,
	): Promise<void> {
		if (!this.client) throw new Error("WebSocket client not initialized");
		const expected_updated_at =
			method === "update"
				? this.serverVersions.get(versionKey(resource, record.id))
				: undefined;

		let raw: unknown;
		try {
			raw = await this.client.call(method, {
				resource,
				filter: {
					id: record.id,
					...(expected_updated_at ? { expected_updated_at } : {}),
				},
				data: record,
			});
		} catch (error) {
			if (isConflictResponse(error)) {
				throw new SaveConflictError(
					resource,
					record.id,
					"Reload to pick up their change before saving again.",
				);
			}
			throw error;
		}

		if (!isFlatWriteResponse(raw)) {
			throw new Error(`Invalid ${resource} write response`);
		}
		// The server's timestamp, not our own: the next save preconditions on it.
		this.serverVersions.set(versionKey(resource, raw.id), raw.updated_at);
	}

	private rememberRemoteVersion({
		resource,
		operation,
		record,
	}: RemoteChange): void {
		if (operation === "delete" || record.deleted_at) {
			this.serverVersions.delete(versionKey(resource, record.id));
			return;
		}
		if (typeof record.updated_at !== "string") return;
		this.serverVersions.set(
			versionKey(resource, record.id),
			record.updated_at,
		);
	}

	/** Adopts the versions in a sync snapshot as the baseline for later writes. */
	private rememberVersionsFromSync(response: SyncResponse): void {
		for (const row of response.data) {
			if (!Array.isArray(row.value)) continue;
			for (const record of row.value) {
				if (!record || typeof record !== "object") continue;
				const { id, updated_at } = record as Record<string, unknown>;
				if (typeof id !== "string" || typeof updated_at !== "string") {
					continue;
				}
				this.serverVersions.set(
					versionKey(row.resource, id),
					updated_at,
				);
			}
		}
	}

	private async deleteRecord(
		resource: FlatResourceRef,
		id: string,
	): Promise<void> {
		if (!this.client) throw new Error("WebSocket client not initialized");
		const raw = await this.client.call("delete", {
			resource,
			filter: { id },
		});
		if (!isFlatWriteResponse(raw)) {
			throw new Error(`Invalid ${resource} delete response`);
		}
		this.serverVersions.delete(versionKey(resource, id));
	}
}

export const wsClient = new WSClient();
