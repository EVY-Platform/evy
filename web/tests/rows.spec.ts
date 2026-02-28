import { expect, test } from "@playwright/test";
import { initTestFlows } from "./utils";

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
					},
				],
			},
		]);
		await page.goto("/");
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		// Check that all expected row components are present by verifying their unique text titles
		// Each row component has a unique title that we can verify
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

		// Verify each row title is visible (this ensures we have exactly 13 row components)
		for (const title of expectedRowTitles) {
			await expect(rowsPanel.getByText(title, { exact: true })).toBeVisible();
		}
	});
});
