import { expect, test } from "@playwright/test";
import { openAppWithTestFlows } from "./flowFixtures";
import { installMockWebSocket } from "./mockWebSocket";
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
		await installMockWebSocket(page, {
			write: "failCreate",
			rows: [
				{
					resource: "flows",
					value: [
						{
							id: "1f9f6a3e-8f04-4c85-9b6f-0d0d3a8f5b01",
							name: "Offline Save Fail",
							page_ids: ["2a7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d02"],
							visibility: "public",
							created_at: "2026-07-01T00:00:00.000Z",
							updated_at: "2026-07-01T00:00:00.000Z",
						},
					],
				},
				{
					resource: "pages",
					value: [
						{
							id: "2a7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d02",
							name: "Page",
							title: "Page",
							row_ids: [],
							visibility: "public",
							created_at: "2026-07-01T00:00:00.000Z",
							updated_at: "2026-07-01T00:00:00.000Z",
						},
					],
				},
				{ resource: "rows", value: [] },
			],
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
