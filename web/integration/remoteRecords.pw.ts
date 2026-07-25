import { expect, test } from "@playwright/test";
import {
	ensureSidePanelsExpanded,
	getPageContent,
	getSidebarRow,
	waitForAppLoaded,
} from "./utils";

declare global {
	interface Window {
		__evyWrites: { method: string; params: Record<string, unknown> }[];
		__evyPushRemoteRow: () => void;
	}
}

/**
 * A `dataChanged` push carries `value`, and the builder has to read it in one
 * place. Reading it two different ways left the version map never updated, and
 * applying a push looked like a local edit to autosave, which wrote the change
 * straight back to the server it came from.
 */
test.describe("Remote records", () => {
	test("applies a push without echoing it, and preconditions on its version", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			window.__evyWrites = [];
			const EVY_CORE_SERVICE = "475731ac-31aa-4d65-94d2-7032782ae359";
			const FLOW_ID = "5d9f6a3e-8f04-4c85-9b6f-0d0d3a8f5b05";
			const PAGE_ID = "6e7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d06";
			const ROW_ID = "7f8d2e5c-6f23-4a87-9d4e-2f2f5cadbe07";
			const SYNCED_VERSION = "2026-07-01T00:00:00.000Z";
			const PUSHED_VERSION = "2026-07-05T00:00:00.000Z";

			const mockFlow = {
				id: FLOW_ID,
				name: "Remote Flow",
				pageIds: [PAGE_ID],
				visibility: "public",
				createdAt: SYNCED_VERSION,
				updatedAt: SYNCED_VERSION,
			};
			const mockPage = {
				id: PAGE_ID,
				name: "Page",
				title: "Page",
				rowIds: [ROW_ID],
				visibility: "public",
				createdAt: SYNCED_VERSION,
				updatedAt: SYNCED_VERSION,
			};
			const mockRow = {
				id: ROW_ID,
				name: "Remote Row",
				type: "Text",
				visible: "true",
				visibility: "public",
				data: { title: "Before", actions: {} },
				createdAt: SYNCED_VERSION,
				updatedAt: SYNCED_VERSION,
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
					// Lets the test act as the other editor.
					window.__evyPushRemoteRow = () => {
						this.respond({
							jsonrpc: "2.0",
							method: "dataChanged",
							params: {
								service: EVY_CORE_SERVICE,
								resource: "rows",
								operation: "update",
								value: {
									...mockRow,
									data: {
										title: "After",
										actions: {},
									},
									updatedAt: PUSHED_VERSION,
								},
							},
						});
					};
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
										value: [mockRow],
									},
								],
							},
						});
						return;
					}

					if (
						request.method === "create" ||
						request.method === "update" ||
						request.method === "delete"
					) {
						window.__evyWrites.push({
							method: request.method,
							params: request.params ?? {},
						});
						const record = (request.params?.data ?? {
							id: (request.params?.filter as { id?: string })?.id,
						}) as Record<string, unknown>;
						this.respond({
							jsonrpc: "2.0",
							id: request.id,
							result: {
								...record,
								createdAt: SYNCED_VERSION,
								updatedAt: "2026-07-09T00:00:00.000Z",
							},
						});
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
		await expect(getPageContent(page).getByText("Before")).toBeVisible();

		// The other editor saves.
		await page.evaluate(() => window.__evyPushRemoteRow());

		// Their change is visible here...
		await expect(getPageContent(page).getByText("After")).toBeVisible();
		// ...and was not written back to the server it came from.
		expect(await page.evaluate(() => window.__evyWrites)).toEqual([]);

		// A later local edit preconditions on the version the push carried,
		// so it is not reported as a conflict with a change we already have.
		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(getPageContent(page));

		await expect
			.poll(async () =>
				page.evaluate(() =>
					window.__evyWrites.some((w) => w.method === "update"),
				),
			)
			.toBe(true);

		const rowUpdate = await page.evaluate(() =>
			window.__evyWrites.find(
				(w) =>
					w.method === "update" &&
					(w.params.filter as { id?: string })?.id ===
						"7f8d2e5c-6f23-4a87-9d4e-2f2f5cadbe07",
			),
		);
		if (rowUpdate) {
			expect(
				(rowUpdate.params.filter as { expectedUpdatedAt?: string })
					.expectedUpdatedAt,
			).toBe("2026-07-05T00:00:00.000Z");
		}
	});
});
