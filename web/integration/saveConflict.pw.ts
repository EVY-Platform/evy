import { expect, test } from "@playwright/test";
import { installMockWebSocket } from "./mockWebSocket";
import {
	ensureSidePanelsExpanded,
	getPageContent,
	getSidebarRow,
	waitForAppLoaded,
} from "./utils";

/**
 * Two people editing the same flow used to overwrite each other in silence.
 * The builder now sends the version it last saw from the server, and a write
 * against a version that has moved comes back as a conflict rather than
 * quietly winning.
 */
const FLOW_ID = "3c9f6a3e-8f04-4c85-9b6f-0d0d3a8f5b03";
const PAGE_ID = "4b7c1d4b-5e12-4f96-8c3d-1e1e4b9c6d04";
// The version the server hands out, and therefore the one the builder must
// send back on its next write.
const SERVER_VERSION = "2026-07-01T00:00:00.000Z";

test.describe("Concurrent edit conflicts", () => {
	test("sends the synced version and reports a conflict distinctly", async ({
		page,
	}) => {
		await installMockWebSocket(page, {
			write: "conflictUpdate",
			syncedVersion: SERVER_VERSION,
			rows: [
				{
					resource: "flows",
					value: [
						{
							id: FLOW_ID,
							name: "Conflict Flow",
							page_ids: [PAGE_ID],
							visibility: "public",
							created_at: SERVER_VERSION,
							updated_at: SERVER_VERSION,
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
							row_ids: [],
							visibility: "public",
							created_at: SERVER_VERSION,
							updated_at: SERVER_VERSION,
						},
					],
				},
				{ resource: "rows", value: [] },
			],
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

		const updates = await page.evaluate(() =>
			window.__evyWrites.filter((write) => write.method === "update"),
		);
		expect(updates.length).toBeGreaterThan(0);
		expect(updates[0].params.filter).toMatchObject({
			expected_updated_at: SERVER_VERSION,
		});
	});
});
