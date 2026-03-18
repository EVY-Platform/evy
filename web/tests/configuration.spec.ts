import { expect, test, type Locator, type Page } from "@playwright/test";
import { initTestFlows, initFullFlows } from "./utils";

function getConfigPanel(page: Page): Locator {
	return page.getByText("Configuration", { exact: true }).locator("..");
}

async function popoverSelect(
	page: Page,
	trigger: Locator,
	optionLabel: string,
) {
	await trigger.click();
	await page
		.getByRole("listbox")
		.getByRole("option", { name: optionLabel, exact: true })
		.click();
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

		const configPanel = getConfigPanel(page);

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

		const configPanel = getConfigPanel(page);

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

		const configPanel = getConfigPanel(page);

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

		const configPanel = getConfigPanel(page);

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

		const configPanel = getConfigPanel(page);

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

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByText("Actions", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByText("Row has no actions")).toBeVisible();
	});

	test("should select navigate action with cascading flow and page dropdowns", async ({
		page,
	}) => {
		await initFullFlows(page, [
			{
				id: "flow_a",
				name: "Onboarding",
				type: "create",
				data: "",
				pages: [
					{
						id: "page_a1",
						title: "Welcome",
						rows: [
							{
								id: "row_btn",
								type: "Button",
								view: { content: { title: "", label: "Go" } },
								actions: [{ condition: "", false: "", true: "" }],
							},
						],
					},
				],
			},
			{
				id: "flow_b",
				name: "Checkout",
				type: "create",
				data: "",
				pages: [
					{
						id: "page_b1",
						title: "Payment",
						rows: [],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Go", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const trueFn = popup.getByLabel("true-0-function");
		await popoverSelect(page, trueFn, "Navigate");

		const flowArg = popup.getByLabel("true-0-arg-0");
		await expect(flowArg).toBeVisible();
		await popoverSelect(page, flowArg, "Checkout");

		const pageArg = popup.getByLabel("true-0-arg-1");
		await expect(pageArg).toBeVisible();
		await popoverSelect(page, pageArg, "Payment");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("navigate(Checkout, Payment)"),
		).toBeVisible();
	});

	test("should select create action with data model argument", async ({
		page,
	}) => {
		await initFullFlows(page, [
			{
				id: "flow_c",
				name: "Listing",
				type: "create",
				data: "items",
				pages: [
					{
						id: "page_c1",
						title: "Details",
						rows: [
							{
								id: "row_btn2",
								type: "Button",
								view: {
									content: { title: "", label: "Create Item" },
								},
								actions: [{ condition: "", false: "", true: "" }],
							},
						],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Create Item", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const trueFn = popup.getByLabel("true-0-function");
		await popoverSelect(page, trueFn, "Create");

		const dataArg = popup.getByLabel("true-0-arg-0");
		await expect(dataArg).toBeVisible();
		await popoverSelect(page, dataArg, "Items");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("create(items)")).toBeVisible();
	});

	test("should use number operand in condition", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Input",
						view: {
							content: {
								title: "Price",
								value: "{price}",
								placeholder: "",
							},
						},
						destination: "{price}",
						actions: [],
					},
					{
						type: "Button",
						view: { content: { title: "", label: "Check" } },
						actions: [{ condition: "", false: "", true: "close" }],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Check", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const leftOperand = popup.getByLabel("condition-0-0-left");
		const rightOperand = popup.getByLabel("condition-0-0-right");

		await popoverSelect(page, leftOperand, "Price");
		await popoverSelect(page, rightOperand, "number");

		const numberInput = popup.getByLabel("condition-0-0-right-number");
		await expect(numberInput).toBeVisible();
		await expect(numberInput).toHaveValue("0");

		await numberInput.fill("42");
		await expect(numberInput).toHaveValue("42");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("price equals 42")).toBeVisible();
	});

	test("should use function operand in condition", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Input",
						view: {
							content: {
								title: "Items",
								value: "{items}",
								placeholder: "",
							},
						},
						destination: "{items}",
						actions: [],
					},
					{
						type: "Button",
						view: { content: { title: "", label: "Validate" } },
						actions: [{ condition: "", false: "", true: "close" }],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Validate", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const leftOperand = popup.getByLabel("condition-0-0-left");
		const rightOperand = popup.getByLabel("condition-0-0-right");

		await popoverSelect(page, leftOperand, "count(...)");

		const fnArgDropdown = popup.getByLabel("condition-0-0-left-arg");
		await expect(fnArgDropdown).toBeVisible();
		await popoverSelect(page, fnArgDropdown, "Items");

		await popoverSelect(page, rightOperand, "Items");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("count(items) equals items"),
		).toBeVisible();
	});

	test("should add multiple OR conditions and remove one", async ({ page }) => {
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
								placeholder: "",
							},
						},
						destination: "{name}",
						actions: [],
					},
					{
						type: "Input",
						view: {
							content: {
								title: "Email",
								value: "{email}",
								placeholder: "",
							},
						},
						destination: "{email}",
						actions: [],
					},
					{
						type: "Button",
						view: { content: { title: "", label: "Send" } },
						actions: [{ condition: "", false: "", true: "close" }],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Send", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const left0 = popup.getByLabel("condition-0-0-left");
		const right0 = popup.getByLabel("condition-0-0-right");
		await popoverSelect(page, left0, "Name");
		await popoverSelect(page, right0, "Email");

		const left1 = popup.getByLabel("condition-0-1-left");
		const op1 = popup.getByLabel("condition-0-1-op");
		const right1 = popup.getByLabel("condition-0-1-right");
		await popoverSelect(page, left1, "Email");
		await popoverSelect(page, op1, "not equals");
		await popoverSelect(page, right1, "Name");

		await expect(popup.locator(".evy-condition-or")).toHaveCount(2);

		await popup.getByLabel("Remove condition 1").click();

		await expect(popup.locator(".evy-condition-or")).toHaveCount(1);

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("email not equals name")).toBeVisible();
	});

	test("should discard changes when cancel is clicked", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Button",
						view: { content: { title: "", label: "Cancel Test" } },
						actions: [{ condition: "", false: "", true: "close" }],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Cancel Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await expect(configPanel.getByText("If true:")).toBeVisible();
		await expect(configPanel.getByText("close")).toBeVisible();

		await configPanel.getByLabel("Edit action 1").click();
		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const trueFn = popup.getByLabel("true-0-function");
		await popoverSelect(page, trueFn, "Navigate");
		await expect(trueFn).toHaveAttribute("data-value", "navigate");

		await popup.getByRole("button", { name: "Cancel" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("close")).toBeVisible();
		await expect(
			configPanel.getByText("navigate", { exact: true }),
		).not.toBeVisible();
	});

	test("should remove an action from summary card", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Button",
						view: {
							content: { title: "", label: "Multi Action" },
						},
						actions: [
							{ condition: "", false: "", true: "close" },
							{ condition: "", false: "", true: "{create()}" },
						],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Multi Action", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(configPanel.getByText("Action 1")).toBeVisible();
		await expect(configPanel.getByText("Action 2")).toBeVisible();

		await configPanel.getByLabel("Remove action 1").click();

		await expect(configPanel.getByText("Action 1")).toBeVisible();
		await expect(configPanel.getByText("Action 2")).not.toBeVisible();
	});

	test("should load pre-populated action fields correctly in popup", async ({
		page,
	}) => {
		await initFullFlows(page, [
			{
				id: "flow_x",
				name: "Main Flow",
				type: "create",
				data: "",
				pages: [
					{
						id: "page_x",
						title: "Step One",
						rows: [
							{
								id: "row_input",
								type: "Input",
								view: {
									content: {
										title: "Name",
										value: "{name}",
										placeholder: "",
									},
								},
								destination: "{name}",
								actions: [],
							},
							{
								id: "row_btn",
								type: "Button",
								view: {
									content: { title: "", label: "Prefilled" },
								},
								actions: [
									{
										condition: "{name == true}",
										true: "{navigate(flow_x,page_x)}",
										false: "close",
									},
								],
							},
						],
					},
				],
			},
		]);
		await page.goto("/");

		const buttonRow = page.getByText("Prefilled", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const condLeft = popup.getByRole("combobox", {
			name: "condition-0-0-left",
			exact: true,
		});
		const condOp = popup.getByRole("combobox", {
			name: "condition-0-0-op",
			exact: true,
		});
		const condRight = popup.getByRole("combobox", {
			name: "condition-0-0-right",
			exact: true,
		});
		await expect(condLeft).toHaveAttribute("data-value", "name");
		await expect(condOp).toHaveAttribute("data-value", "==");
		await expect(condRight).toHaveAttribute("data-value", "__boolean__");

		const boolDropdown = popup.getByRole("combobox", {
			name: "condition-0-0-right-boolean",
		});
		await expect(boolDropdown).toHaveAttribute("data-value", "true");

		const trueFn = popup.getByLabel("true-0-function");
		await expect(trueFn).toHaveAttribute("data-value", "navigate");

		const trueFlowArg = popup.getByLabel("true-0-arg-0");
		await expect(trueFlowArg).toHaveAttribute("data-value", "flow_x");

		const truePageArg = popup.getByLabel("true-0-arg-1");
		await expect(truePageArg).toHaveAttribute("data-value", "page_x");

		const falseFn = popup.getByLabel("false-0-function");
		await expect(falseFn).toHaveAttribute("data-value", "close");
	});
});
