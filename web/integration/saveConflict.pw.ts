import { expect, test } from "@playwright/test";
import {
	ensureSidePanelsExpanded,
	getPageContent,
	getSidebarRow,
	waitForAppLoaded,
} from "./utils";

declare global {
	interface Window {
		__evyUpdateParams: unknown[];
	}
}

/**
 * Two people editing the same flow used to overwrite each other in silence.
 * The builder now sends the version it last saw from the server, and a write
 * against a version that has moved comes back as a conflict rather than
 * quietly winning.
 */
test.describe("Concurrent edit conflicts", () => {
	test("sends the synced version and reports a conflict distinctly", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			window.__evyUpdateParams = [];
			const EVY_CORE_SERVICE = "475731ac-31aa-4d65-94d2-7032782ae359";
			const FLOW_ID = "3c9f6a3e-8f04-4c85-9b6f-0d0d3a8f5b03";
			const PAGE_ID = "4b7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d04";
			// The version the server hands out, and therefore the one the
			// builder must send back on its next write.
			const SERVER_VERSION = "2026-07-01T00:00:00.000Z";

			const mockFlow = {
				id: FLOW_ID,
				name: "Conflict Flow",
				pageIds: [PAGE_ID],
				visibility: "public",
				createdAt: SERVER_VERSION,
				updatedAt: SERVER_VERSION,
			};
			const mockPage = {
				id: PAGE_ID,
				name: "Page",
				title: "Page",
				rowIds: [],
				visibility: "public",
				createdAt: SERVER_VERSION,
				updatedAt: SERVER_VERSION,
			};

			class MockWebSocket extends EventTarget {
				static CONNECTING = 0;
				static OPEN = 1;
				static CLOSING = 2;
				static CLOSED = 3;

				readyState = MockWebSocket.CONNECTING;
				onopen: ((event: Event) => void) | null = null;
				onmessage: ((event: MessageEvent<string>) => void) | null =
					null;
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
				}

				send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
					const asText = typeof data === "string" ? data : null;
					if (!asText) return;

					const request = JSON.parse(asText) as {
						id?: number | string;
						method?: string;
						params?: Record<string, unknown>;
					};

					if (
						request.method === "rpc.login" ||
						request.method === "rpc.on"
					) {
						this.respond({
							jsonrpc: "2.0",
							id: request.id,
							result:
								request.method === "rpc.on"
									? { dataChanged: "ok" }
									: true,
						});
						return;
					}

					if (
						request.method === "sync" ||
						(request.method === "api" &&
							request.params?.method === "sync")
					) {
						this.respond({
							jsonrpc: "2.0",
							id: request.id,
							result: {
								cursor: "1970-01-01T00:00:00.000Z",
								data: [
									{
										service: EVY_CORE_SERVICE,
										resource: "flows",
										value: [mockFlow],
									},
									{
										service: EVY_CORE_SERVICE,
										resource: "pages",
										value: [mockPage],
									},
									{
										service: EVY_CORE_SERVICE,
										resource: "rows",
										value: [],
									},
								],
							},
						});
						return;
					}

					if (request.method === "create") {
						const record = request.params?.data as {
							id: string;
							createdAt: string;
						};
						this.respond({
							jsonrpc: "2.0",
							id: request.id,
							result: {
								...record,
								createdAt: SERVER_VERSION,
								updatedAt: SERVER_VERSION,
							},
						});
						return;
					}

					if (request.method === "update") {
						window.__evyUpdateParams.push(request.params);
						// Somebody else saved first.
						this.respond({
							jsonrpc: "2.0",
							id: request.id,
							error: {
								code: -32000,
								message:
									"Conflict: the record changed since you last read it " +
									`(expected updatedAt ${SERVER_VERSION}, found 2026-07-02T00:00:00.000Z). ` +
									"Re-read the record and reapply your change.",
							},
						});
						return;
					}
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
		});

		await page.goto("/");
		await waitForAppLoaded(page);
		await ensureSidePanelsExpanded(page);

		const conflictMessage = new Promise<string>((resolve) => {
			page.once("dialog", (dialog) => {
				resolve(dialog.message());
				void dialog.accept();
			});
		});

		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(getPageContent(page));

		// Names the actual problem rather than blaming the connection.
		const message = await conflictMessage;
		expect(message).toContain("Someone else changed this");
		expect(message).not.toContain("check your connection");

		const updates = await page.evaluate(() => window.__evyUpdateParams);
		expect(updates.length).toBeGreaterThan(0);
		const filter = (updates[0] as { filter: Record<string, unknown> })
			.filter;
		expect(filter.expectedUpdatedAt).toBe("2026-07-01T00:00:00.000Z");
	});
});
