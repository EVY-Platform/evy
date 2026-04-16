import { expect, test } from "@playwright/test";
import {
	createNewFlowThroughPicker,
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
			const OriginalWebSocket = window.WebSocket;
			window.WebSocket = class extends OriginalWebSocket {
				override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
					const asText =
						typeof data === "string"
							? data
							: data instanceof ArrayBuffer
								? new TextDecoder().decode(data)
								: null;
					if (asText !== null && /"method"\s*:\s*"upsert"/.test(asText)) {
						throw new Error("Simulated WebSocket send failure");
					}
					super.send(data);
				}
			} as unknown as typeof WebSocket;
		});

		const uniqueFlowName = `Offline Save Fail ${Date.now()}`;

		await page.goto("/");
		await waitForAppLoaded(page);

		await createNewFlowThroughPicker(page, uniqueFlowName);

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
