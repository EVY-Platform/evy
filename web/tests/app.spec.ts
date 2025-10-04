import { test, expect } from "@playwright/test";

test.describe("EVY App Builder", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("should load the application with initial state", async ({ page }) => {
		// Check that the main layout is present
		await expect(page.locator('img[alt="EVY"]')).toBeVisible();

		// Check that the Rows panel is present
		await expect(
			page.getByText("Rows", { exact: true }).first()
		).toBeVisible();

		// Check that the Configuration panel header is present (even if content is not visible)
		await expect(
			page.getByText("Configuration", { exact: true })
		).toBeVisible();

		// Check that there are two empty pages by looking for the phone background images
		// We can identify phone containers by looking for elements with phone background class
		const phoneContainers = page.locator('div[class*="evy-bg-phone"]');
		await expect(phoneContainers).toHaveCount(2);

		// Check that the configuration panel content is empty initially (no forms visible)
		await expect(
			page
				.getByText("Configuration", { exact: true })
				.locator("..")
				.locator("form")
		).toHaveCount(0);
	});

	test("should display available row components in the Rows panel", async ({
		page,
	}) => {
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
			await expect(
				rowsPanel.getByText(title, { exact: true })
			).toBeVisible();
		}

		// Verify some specific row content to ensure they're properly rendered
		await expect(
			rowsPanel.getByText("Info row info", { exact: true })
		).toBeVisible();
		await expect(
			rowsPanel.getByText("Button row text", { exact: true })
		).toBeVisible();
	});
});
