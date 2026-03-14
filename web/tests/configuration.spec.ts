import { expect, test } from "@playwright/test";
import { initTestFlows } from "./utils";

test.describe("Row configuration", () => {
	test("should drill into child row configuration from the configuration panel", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "ColumnContainer",
						view: {
							content: {
								title: "Container Row",
								children: [
									{
										type: "Input",
										view: {
											content: {
												title: "Input Row",
												placeholder: "First placeholder",
											},
										},
										actions: [],
									},
								],
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");

		const containerRow = page
			.getByText("Container Row", { exact: true })
			.first();
		await expect(containerRow).toBeVisible();
		await containerRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		await expect(page.getByLabel("Page title")).toHaveValue("Test Page");
		await expect(
			configPanel.getByRole("button", { name: /^Input$/ }),
		).toBeVisible();

		await configPanel.getByRole("button", { name: /^Input$/ }).click();

		await expect(configPanel.getByLabel("Page title")).toHaveCount(0);
		await expect(
			configPanel.getByRole("button", {
				name: "Back to parent configuration from Input",
			}),
		).toBeVisible();
		await expect(configPanel.getByLabel("placeholder")).toHaveValue(
			"First placeholder",
		);
		await expect(configPanel.getByLabel("title")).toHaveValue("Input Row");
	});

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
						actions: [],
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

	test("should display and edit action items in configuration panel", async ({
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
						actions: [{ condition: "", false: "", true: "close" }],
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

		await expect(configPanel.getByText("Actions")).toBeVisible();
		await expect(configPanel.getByLabel("condition-0")).toHaveValue("");
		await expect(configPanel.getByLabel("false-0")).toHaveValue("");
		await expect(configPanel.getByLabel("true-0")).toHaveValue("close");

		await configPanel.getByLabel("true-0").fill("{create(item)}");
		await expect(configPanel.getByLabel("true-0")).toHaveValue(
			"{create(item)}",
		);
	});

	test("should add another action item in configuration panel", async ({
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
						actions: [{ condition: "", false: "", true: "{create(item)}" }],
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

		await expect(configPanel.getByLabel("true-0")).toHaveValue(
			"{create(item)}",
		);
		await configPanel.getByRole("button", { name: "Add action" }).click();
		await expect(configPanel.getByLabel("condition-1")).toHaveValue("");
		await expect(configPanel.getByLabel("false-1")).toHaveValue("");
		await expect(configPanel.getByLabel("true-1")).toHaveValue("");
	});

	test("should show empty actions state for rows without actions", async ({
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
						actions: [],
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

		await expect(
			configPanel.getByText("Actions", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByText("Row has no actions")).toBeVisible();
	});
});
