import { expect, test } from "@playwright/test";
import { openAppWithTestFlows } from "./flowFixtures";
import {
	ensureSidePanelsExpanded,
	getConfigPanel,
	getFirstPage,
	getPageContent,
	getSidebarRow,
	installConstructorFailingWebSocket,
	waitForAppLoaded,
} from "./utils";

test.describe("Offline and connection resilience", () => {
	test("shows browser alert when create cannot be sent over WebSocket", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const EVY_CORE_SERVICE = "475731ac-31aa-4d65-94d2-7032782ae359";
			// Ids must be real UUIDs — the sync response is checked with the shared schema validators.
			const OFFLINE_FLOW_ID = "1f9f6a3e-8f04-4c85-9b6f-0d0d3a8f5b01";
			const OFFLINE_PAGE_ID = "2a7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d02";
			const nowIso = new Date().toISOString();
			const mockFlow = {
				id: OFFLINE_FLOW_ID,
				name: "Offline Save Fail",
				pageIds: [OFFLINE_PAGE_ID],
				visibility: "public",
				createdAt: nowIso,
				updatedAt: nowIso,
			};
			const mockPage = {
				id: OFFLINE_PAGE_ID,
				name: "Page",
				title: "Page",
				rowIds: [],
				visibility: "public",
				createdAt: nowIso,
				updatedAt: nowIso,
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
						params?: { method?: string };
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
							result: { dataChanged: "ok" },
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

		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(getPageContent(page));

		await expect(
			getFirstPage(page).getByText("Text row title", { exact: true }),
		).toBeVisible();
	});

	test("injected flows keep builder UI usable without a successful API read path", async ({
		page,
	}) => {
		await installConstructorFailingWebSocket(
			page,
			"No WebSocket in this test",
		);
		await openAppWithTestFlows(page, [
			{ id: "p1", title: "Offline page", rows: [] },
		]);
		await ensureSidePanelsExpanded(page);

		await expect(
			page.getByText("Rows", { exact: true }).first(),
		).toBeVisible();
		await expect(getConfigPanel(page)).toBeVisible();
		await expect(
			getFirstPage(page).getByText("Offline page", { exact: true }),
		).toBeVisible();
	});
});
