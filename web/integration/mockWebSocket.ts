import type { Page } from "@playwright/test";

export type MockSyncRow = { resource: string; value: unknown };

export type MockWriteBehaviour =
	/** Echo the record back with server timestamps. */
	| "accept"
	/** Every create fails at the transport, as if the socket were dead. */
	| "failCreate"
	/** Every update comes back as an optimistic-lock conflict. */
	| "conflictUpdate";

export type MockWebSocketConfig = {
	rows: MockSyncRow[];
	write?: MockWriteBehaviour;
	/** updated_at the sync snapshot carries, and the version writes must send. */
	syncedVersion?: string;
	/** updated_at returned by an accepted write. */
	writtenVersion?: string;
};

declare global {
	interface Window {
		/** Every create/update/delete the app sent, in order. */
		__evyWrites: { method: string; params: Record<string, unknown> }[];
		/** Pushes a dataChanged notification, as another editor would cause. */
		__evyPushRemote: (change: {
			resource: string;
			operation: "create" | "update" | "delete";
			value: unknown;
		}) => void;
	}
}

/**
 * Installs a JSON-RPC WebSocket the builder can talk to.
 *
 * Owns the parts every scenario needs identically - connect, login, subscribe,
 * sync, close - so a test only states its rows and how writes should behave.
 * Deliberately not a general mock: new behaviour belongs in the union above,
 * where every test can see what the server can do.
 */
export async function installMockWebSocket(
	page: Page,
	config: MockWebSocketConfig,
): Promise<void> {
	await page.addInitScript((cfg: MockWebSocketConfig) => {
		const EVY_CORE_SERVICE = "evy";
		const syncedVersion = cfg.syncedVersion ?? "2026-07-01T00:00:00.000Z";
		const writtenVersion = cfg.writtenVersion ?? "2026-07-09T00:00:00.000Z";
		const write = cfg.write ?? "accept";
		window.__evyWrites = [];

		class MockWebSocket extends EventTarget {
			static CONNECTING = 0;
			static OPEN = 1;
			static CLOSING = 2;
			static CLOSED = 3;

			readyState = MockWebSocket.CONNECTING;
			onopen: ((event: Event) => void) | null = null;
			onmessage: ((event: MessageEvent<string>) => void) | null = null;
			onclose: ((event: CloseEvent) => void) | null = null;
			onerror: ((event: Event) => void) | null = null;

			constructor(_url: string | URL) {
				super();
				queueMicrotask(() => {
					this.readyState = MockWebSocket.OPEN;
					const openEvent = new Event("open");
					this.dispatchEvent(openEvent);
					this.onopen?.(openEvent);
				});

				window.__evyPushRemote = (change) => {
					this.respond({
						jsonrpc: "2.0",
						method: "data_changed",
						params: {
							resource: change.resource,
							operation: change.operation,
							value: change.value,
						},
					});
				};
			}

			send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
				if (typeof data !== "string") return;
				const request = JSON.parse(data) as {
					id?: number | string;
					method?: string;
					params?: Record<string, unknown>;
				};

				if (request.method === "rpc.login") {
					this.respond({
						jsonrpc: "2.0",
						id: request.id,
						result: true,
					});
					return;
				}
				if (request.method === "rpc.on") {
					this.respond({
						jsonrpc: "2.0",
						id: request.id,
						result: { data_changed: "ok" },
					});
					return;
				}
				if (request.method === "sync") {
					this.respond({
						jsonrpc: "2.0",
						id: request.id,
						result: {
							cursor: "1970-01-01T00:00:00.000Z",
							data: cfg.rows.map((row) => ({
								resource: row.resource,
								value: row.value,
							})),
						},
					});
					return;
				}
				if (request.method === "resources") {
					this.respond({
						jsonrpc: "2.0",
						id: request.id,
						result: {
							services: [
								{
									id: EVY_CORE_SERVICE,
									name: "EVY",
									resources: [],
								},
							],
						},
					});
					return;
				}

				if (
					request.method !== "create" &&
					request.method !== "update" &&
					request.method !== "delete"
				) {
					return;
				}

				window.__evyWrites.push({
					method: request.method,
					params: request.params ?? {},
				});

				if (write === "failCreate" && request.method === "create") {
					throw new Error("Simulated WebSocket send failure");
				}
				if (write === "conflictUpdate" && request.method === "update") {
					this.respond({
						jsonrpc: "2.0",
						id: request.id,
						error: {
							code: -32000,
							message:
								"Conflict: the record changed since you last read it " +
								`(expected updated_at ${syncedVersion}, found ${writtenVersion}). ` +
								"Re-read the record and reapply your change.",
						},
					});
					return;
				}

				const filter = request.params?.filter as
					| { id?: string }
					| undefined;
				const record = (request.params?.data ?? {
					id: filter?.id,
				}) as Record<string, unknown>;
				this.respond({
					jsonrpc: "2.0",
					id: request.id,
					result: {
						...record,
						created_at: syncedVersion,
						updated_at: writtenVersion,
					},
				});
			}

			close() {
				this.readyState = MockWebSocket.CLOSED;
				const closeEvent = new CloseEvent("close");
				this.dispatchEvent(closeEvent);
				this.onclose?.(closeEvent);
			}

			private respond(payload: unknown) {
				queueMicrotask(() => {
					const messageEvent = new MessageEvent("message", {
						data: JSON.stringify(payload),
					});
					this.dispatchEvent(messageEvent);
					this.onmessage?.(messageEvent);
				});
			}
		}

		window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
	}, config);
}
