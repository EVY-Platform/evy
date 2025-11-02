import { test, expect } from "@playwright/test";
import { initTestFlows } from "./utils.tsx";

test.describe("Row configuration", () => {
	test.beforeEach(async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "Test Info Row",
								text: "Initial text content",
							},
						},
					},
				],
			},
		]);
		await page.goto("/");
	});

	test("should display row configurations in configuration panel", async ({
		page,
	}) => {
		// Find and click on the Info row
		const infoRow = page
			.getByText("Test Info Row", { exact: true })
			.first();
		await expect(infoRow).toBeVisible();
		await infoRow.click();

		// Verify that the configuration panel shows configuration inputs
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Verify Info row configuration inputs (title and text)
		await expect(configPanel.getByLabel("title")).toBeVisible();
		await expect(configPanel.getByLabel("text")).toBeVisible();

		// Test updating the Info row's configuration
		const textInput = configPanel.getByLabel("text");
		await textInput.clear();
		await textInput.fill("Updated info text");

		// Verify the update is reflected
		await expect(textInput).toHaveValue("Updated info text");
	});
});
