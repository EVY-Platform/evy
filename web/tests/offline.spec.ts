import { expect, test } from "@playwright/test";
import {
	ensureSidePanelsExpanded,
	getConfigPanel,
	getFirstPage,
	getPageContent,
	getSidebarRow,
	initTestFlows,
	waitForAppLoaded,
} from "./utils";

test.describe("Offline and connection resilience", () => {
	test("shows browser alert when upsert cannot be sent over WebSocket", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const mockFlow = {
				id: "offline-flow",
				name: "Offline Save Fail",
				pages: [{ id: "offline-page", title: "Page", rows: [] }],
			};

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
				}

				send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
					const asText =
						typeof data === "string"
							? data
							: data instanceof ArrayBuffer
								? new TextDecoder().decode(data)
								: null;
					if (!asText) return;

					const request = JSON.parse(asText) as {
						id?: number | string;
						method?: string;
					};

					if (request.method === "rpc.login") {
						this.respond({ jsonrpc: "2.0", id: request.id, result: true });
						return;
					}

					if (request.method === "get") {
						this.respond({
							jsonrpc: "2.0",
							id: request.id,
							result: [mockFlow],
						});
						return;
					}

					if (request.method === "upsert") {
						throw new Error("Simulated WebSocket send failure");
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

		page.once("dialog", (dialog) => {
			expect(dialog.message()).toContain("Failed to save");
			void dialog.accept();
		});

		const sidebarRow = await getSidebarRow(page, "Info row title");
		await sidebarRow.dragTo(getPageContent(page));

		await expect(
			getFirstPage(page).getByText("Info row title", { exact: true }),
		).toBeVisible();
	});

	test("injected flows keep builder UI usable without a successful API read path", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			window.WebSocket = class {
				constructor() {
					throw new Error("No WebSocket in this test");
				}
			} as unknown as typeof WebSocket;
		});
		await initTestFlows(page, [{ id: "p1", title: "Offline page", rows: [] }]);
		await page.goto("/");
		await ensureSidePanelsExpanded(page);

		await expect(page.getByText("Rows", { exact: true }).first()).toBeVisible();
		await expect(getConfigPanel(page)).toBeVisible();
		await expect(
			getFirstPage(page).getByText("Offline page", { exact: true }),
		).toBeVisible();
	});
});
