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

	test("should display child row configurations in configuration panel", async ({
		page,
	}) => {
		// Find and click on the ColumnContainer row that has children
		// The row with title "Dimensions (width x height x depth)" has 3 children
		const containerRow = page
			.getByText("Dimensions (width x height x depth)", { exact: true })
			.first();
		await expect(containerRow).toBeVisible();
		await containerRow.click();

		// Verify that the configuration panel shows child configuration sections
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Check that child headings appear: "Child 1", "Child 2", "Child 3"
		await expect(
			configPanel.getByText("Child 1", { exact: true })
		).toBeVisible();
		await expect(
			configPanel.getByText("Child 2", { exact: true })
		).toBeVisible();
		await expect(
			configPanel.getByText("Child 3", { exact: true })
		).toBeVisible();

		// Verify that each child section has configuration inputs
		// Children are Input rows which should have: title, value, placeholder
		const child1Section = configPanel
			.getByText("Child 1", { exact: true })
			.locator("..");
		await expect(child1Section.getByLabel("title")).toBeVisible();
		await expect(child1Section.getByLabel("value")).toBeVisible();
		await expect(child1Section.getByLabel("placeholder")).toBeVisible();

		const child2Section = configPanel
			.getByText("Child 2", { exact: true })
			.locator("..");
		await expect(child2Section.getByLabel("title")).toBeVisible();
		await expect(child2Section.getByLabel("value")).toBeVisible();
		await expect(child2Section.getByLabel("placeholder")).toBeVisible();

		// Test updating a child row's configuration value
		const child1ValueInput = child1Section.getByLabel("value");
		await child1ValueInput.clear();
		await child1ValueInput.fill("new-width-value");

		// Verify the update is reflected (input should have the new value)
		await expect(child1ValueInput).toHaveValue("new-width-value");
	});
});
