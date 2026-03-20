import { expect, test } from "@playwright/test";
import { getRowsPanel, initTestFlows } from "./utils";

test.describe("EVY Rows", () => {
	test("should display available row components in the Rows panel", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "Test Info",
								text: "Test text",
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");
		const rowsPanel = await getRowsPanel(page);

		const expectedRowTitles = [
			"Info row title",
			"Text row title",
			"Input list row title",
			"Button row text",
			"Text action row title",
			"Calendar row title",
			"Dropdown row title",
			"Inline picker row title",
			"Input row title",
			"Search row title",
			"Select photo row title",
			"Text area row title",
			"Text select row title",
		];

		for (const title of expectedRowTitles) {
			await expect(rowsPanel.getByText(title, { exact: true })).toBeVisible();
		}
	});

	test("should filter rows by search query", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [],
			},
		]);
		await page.goto("/");
		const rowsPanel = await getRowsPanel(page);
		const searchInput = rowsPanel.getByPlaceholder("Button, Calendar, etc...");

		await expect(searchInput).toBeVisible();

		await searchInput.fill("input");

		await expect(
			rowsPanel.getByText("Input row title", { exact: true }),
		).toBeVisible();
		await expect(
			rowsPanel.getByText("Input list row title", { exact: true }),
		).toBeVisible();

		await expect(
			rowsPanel.getByText("Button row text", { exact: true }),
		).not.toBeVisible();
		await expect(
			rowsPanel.getByText("Calendar row title", { exact: true }),
		).not.toBeVisible();
		await expect(
			rowsPanel.getByText("Text row title", { exact: true }),
		).not.toBeVisible();

		await searchInput.clear();

		await expect(
			rowsPanel.getByText("Button row text", { exact: true }),
		).toBeVisible();
		await expect(
			rowsPanel.getByText("Calendar row title", { exact: true }),
		).toBeVisible();
		await expect(
			rowsPanel.getByText("Input row title", { exact: true }),
		).toBeVisible();
	});
});
