import { expect, test, type Locator, type Page } from "@playwright/test";
import { initTestFlows } from "./utils";

async function popoverSelect(
	page: Page,
	trigger: Locator,
	optionLabel: string,
) {
	await trigger.click();
	await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

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
		const infoRow = page.getByText("Test Info Row", { exact: true }).first();
		await expect(infoRow).toBeVisible();
		await infoRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByLabel("text")).toBeVisible();

		const textInput = configPanel.getByLabel("text");
		await textInput.clear();
		await textInput.fill("Updated info text");

		await expect(textInput).toHaveValue("Updated info text");
	});

	test("should display and edit action items via popup", async ({ page }) => {
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
		await expect(configPanel.getByText("If true:")).toBeVisible();
		await expect(configPanel.getByText("Close")).toBeVisible();

		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const trueFunctionSelect = popup.getByLabel("true-0-function");
		await expect(trueFunctionSelect).toHaveAttribute("data-value", "close");

		const falseFunctionSelect = popup.getByLabel("false-0-function");
		await expect(falseFunctionSelect).toHaveAttribute("data-value", "");

		await popoverSelect(page, falseFunctionSelect, "Close");
		await expect(falseFunctionSelect).toHaveAttribute("data-value", "close");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("If false:")).toBeVisible();
	});

	test("should add another action item via popup", async ({ page }) => {
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
						actions: [{ condition: "", false: "", true: "close" }],
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

		await expect(configPanel.getByText("Action 1")).toBeVisible();

		await configPanel.getByRole("button", { name: "Add action" }).click();

		const popup = page.getByRole("dialog", { name: "Edit action 2" });
		await expect(popup).toBeVisible();

		await expect(popup.getByLabel("true-1-function")).toHaveAttribute(
			"data-value",
			"",
		);
		await expect(popup.getByLabel("false-1-function")).toHaveAttribute(
			"data-value",
			"",
		);

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("Action 2")).toBeVisible();
	});

	test("should edit conditions via popup", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Input",
						view: {
							content: {
								title: "Name",
								value: "{name}",
								placeholder: "Enter name",
							},
						},
						destination: "{name}",
						actions: [],
					},
					{
						type: "Button",
						view: {
							content: {
								title: "",
								label: "Submit",
							},
						},
						actions: [{ condition: "", false: "", true: "close" }],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Submit", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const leftOperand = popup.getByLabel("condition-0-0-left");
		const operator = popup.getByLabel("condition-0-0-op");
		const rightOperand = popup.getByLabel("condition-0-0-right");

		await expect(leftOperand).toHaveAttribute("data-value", "");
		await expect(operator).toHaveAttribute("data-value", "==");
		await expect(rightOperand).toHaveAttribute("data-value", "");

		await popoverSelect(page, leftOperand, "Name");
		await popoverSelect(page, operator, "not equals");
		await popoverSelect(page, rightOperand, "boolean");

		const committedLeft = popup.getByRole("combobox", {
			name: "condition-0-0-left",
			exact: true,
		});
		const committedOp = popup.getByRole("combobox", {
			name: "condition-0-0-op",
			exact: true,
		});
		const committedRight = popup.getByRole("combobox", {
			name: "condition-0-0-right",
			exact: true,
		});

		await expect(committedLeft).toHaveAttribute("data-value", "name");
		await expect(committedOp).toHaveAttribute("data-value", "!=");
		await expect(committedRight).toHaveAttribute("data-value", "__boolean__");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("Name not equals true")).toBeVisible();
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
