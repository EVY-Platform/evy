import { expect, test } from "@playwright/test";
import { installMockWebSocket } from "./mockWebSocket";
import {
	ensureSidePanelsExpanded,
	getPageContent,
	getSidebarRow,
	waitForAppLoaded,
} from "./utils";

const FLOW_ID = "5d9f6a3e-8f04-4c85-9b6f-0d0d3a8f5b05";
const PAGE_ID = "6e7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d06";
const ROW_ID = "7f8d2e5c-6f23-4a87-9d4e-2f2f5cadbe07";
const SYNCED_VERSION = "2026-07-01T00:00:00.000Z";
const PUSHED_VERSION = "2026-07-05T00:00:00.000Z";

const mockRow = {
	id: ROW_ID,
	name: "Remote Row",
	type: "text",
	visible: "true",
	visibility: "public",
	data: { title: "Before", actions: {} },
	created_at: SYNCED_VERSION,
	updated_at: SYNCED_VERSION,
};

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
		await installMockWebSocket(page, {
			syncedVersion: SYNCED_VERSION,
			rows: [
				{
					resource: "flows",
					value: [
						{
							id: FLOW_ID,
							name: "Remote Flow",
							page_ids: [PAGE_ID],
							visibility: "public",
							created_at: SYNCED_VERSION,
							updated_at: SYNCED_VERSION,
						},
					],
				},
				{
					resource: "pages",
					value: [
						{
							id: PAGE_ID,
							name: "Page",
							title: "Page",
							row_ids: [ROW_ID],
							visibility: "public",
							created_at: SYNCED_VERSION,
							updated_at: SYNCED_VERSION,
						},
					],
				},
				{ resource: "rows", value: [mockRow] },
			],
		});

		await page.goto("/");
		await waitForAppLoaded(page);
		await ensureSidePanelsExpanded(page);
		await expect(getPageContent(page).getByText("Before")).toBeVisible();

		// The other editor saves.
		await page.evaluate(
			({ row, version }) =>
				window.__evyPushRemote({
					resource: "rows",
					operation: "update",
					value: {
						...row,
						data: { title: "After", actions: {} },
						updated_at: version,
					},
				}),
			{ row: mockRow, version: PUSHED_VERSION },
		);

		// Their change is visible here...
		await expect(getPageContent(page).getByText("After")).toBeVisible();
		// ...and was not written back to the server it came from.
		expect(await page.evaluate(() => window.__evyWrites)).toEqual([]);

		// The version a push carries becomes the next write's precondition, so
		// a change the editor has already received is not reported back as a
		// conflict. Pushed on the page, because that is what a drag writes.
		await page.evaluate(
			({ pageId, rowId, version }) =>
				window.__evyPushRemote({
					resource: "pages",
					operation: "update",
					value: {
						id: pageId,
						name: "Page",
						title: "Page",
						row_ids: [rowId],
						visibility: "public",
						created_at: "2026-07-01T00:00:00.000Z",
						updated_at: version,
					},
				}),
			{ pageId: PAGE_ID, rowId: ROW_ID, version: PUSHED_VERSION },
		);

		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(getPageContent(page));

		await expect
			.poll(async () =>
				page.evaluate(
					(pageId) =>
						window.__evyWrites.find(
							(write) =>
								write.method === "update" &&
								(write.params.filter as { id?: string })?.id ===
									pageId,
						)?.params.filter,
					PAGE_ID,
				),
			)
			.toMatchObject({ expected_updated_at: PUSHED_VERSION });
	});
});
