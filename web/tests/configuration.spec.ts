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

		await expect(configPanel.getByText("Action")).toBeVisible();

		const closeButton = configPanel.getByRole("button", { name: "Close" });
		const submitButton = configPanel.getByRole("button", { name: "Submit" });
		const navigateButton = configPanel.getByRole("button", {
			name: "Navigate",
		});

		await expect(closeButton).toBeVisible();
		await expect(submitButton).toBeVisible();
		await expect(navigateButton).toBeVisible();

		await expect(closeButton).toHaveClass(/evy-bg-gray-light/);
		await expect(submitButton).not.toHaveClass(/evy-bg-gray-light/);

		await submitButton.click();
		await expect(submitButton).toHaveClass(/evy-bg-gray-light/);
		await expect(closeButton).not.toHaveClass(/evy-bg-gray-light/);
	});

	test("should show navigate inputs when navigate is selected", async ({
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
								label: "Nav Button",
							},
						},
						action: {
							target: "submit",
						},
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Nav Button", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		await expect(
			configPanel.getByLabel("flow", { exact: true }),
		).not.toBeVisible();
		await expect(
			configPanel.getByLabel("page", { exact: true }),
		).not.toBeVisible();

		await configPanel.getByRole("button", { name: "Navigate" }).click();

		await expect(configPanel.getByLabel("flow", { exact: true })).toBeVisible();
		await expect(configPanel.getByLabel("page", { exact: true })).toBeVisible();
	});

	test("should show no segment selected for rows without action", async ({
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

		await expect(configPanel.getByText("Action")).toBeVisible();

		const navigateButton = configPanel.getByRole("button", {
			name: "Navigate",
		});
		const submitButton = configPanel.getByRole("button", { name: "Submit" });
		const closeButton = configPanel.getByRole("button", { name: "Close" });

		await expect(navigateButton).not.toHaveClass(/evy-bg-gray-light/);
		await expect(submitButton).not.toHaveClass(/evy-bg-gray-light/);
		await expect(closeButton).not.toHaveClass(/evy-bg-gray-light/);
	});
});
