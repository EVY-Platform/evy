import { expect, test } from "@playwright/test";
import { initTestFlows } from "./utils";

test.describe("Row configuration", () => {
	test("should display row configurations in configuration panel", async ({
		page,
	}) => {
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
		// Find and click on the Info row
		const infoRow = page.getByText("Test Info Row", { exact: true }).first();
		await expect(infoRow).toBeVisible();
		await infoRow.click();

		// Verify that the configuration panel shows configuration inputs
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Verify Info row configuration inputs (title and text)
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByLabel("text")).toBeVisible();

		// Test updating the Info row's configuration
		const textInput = configPanel.getByLabel("text");
		await textInput.clear();
		await textInput.fill("Updated info text");

		// Verify the update is reflected
		await expect(textInput).toHaveValue("Updated info text");
	});

	test("should display and edit action target in configuration panel", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Button",
						view: {
							content: {
								title: "",
								label: "Test Button",
							},
						},
						action: {
							target: "close",
						},
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Test Button", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Verify the Action section heading exists
		await expect(configPanel.getByText("Action")).toBeVisible();

		// Verify the target input shows the current value
		const targetInput = configPanel.getByLabel("target");
		await expect(targetInput).toBeVisible();
		await expect(targetInput).toHaveValue("close");

		// Edit the target value
		await targetInput.clear();
		await targetInput.fill("submit");
		await expect(targetInput).toHaveValue("submit");
	});

	test("should show empty action target for rows without action", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "No Action Row",
								text: "Some text",
							},
						},
					},
				],
			},
		]);
		await page.goto("/");

		const infoRow = page.getByText("No Action Row", { exact: true }).first();
		await expect(infoRow).toBeVisible();
		await infoRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Action section should still appear
		await expect(configPanel.getByText("Action")).toBeVisible();

		// Target input should be empty
		const targetInput = configPanel.getByLabel("target");
		await expect(targetInput).toBeVisible();
		await expect(targetInput).toHaveValue("");
	});
});
