import { expect, test } from "@playwright/test";
import {
	getConfigPanel,
	initFullFlows,
	openAppWithTestFlows,
	popoverSelect,
} from "./utils";

test.describe("Row configuration", () => {
	test("should drill into child row configuration from the configuration panel", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
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
		const containerRow = page
			.getByText("Container Row", { exact: true })
			.first();
		await expect(containerRow).toBeVisible();
		await containerRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			page.getByRole("button", { name: "Select page Test Page" }),
		).toBeVisible();
		await expect(
			configPanel.getByRole("button", { name: /^Input$/ }),
		).toBeVisible();

		await configPanel.getByRole("button", { name: /^Input$/ }).click();

		await expect(configPanel.getByLabel("Page title")).toHaveCount(0);
		await expect(
			page.getByRole("button", {
				name: "Configure nested row at depth 1: Input Row",
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
		await openAppWithTestFlows(page, [
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
		await openAppWithTestFlows(page, [
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
		const buttonRow = page.getByText("Test Button", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(configPanel.getByText("Actions")).toBeVisible();
		await expect(configPanel.getByText("If true")).toBeVisible();
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

		await expect(configPanel.getByText("If false")).toBeVisible();
	});

	test("should add another action item via popup", async ({ page }) => {
		await openAppWithTestFlows(page, [
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
		await openAppWithTestFlows(page, [
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
		await openAppWithTestFlows(page, [
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
				pages: [
					{
						id: "page_c1",
						title: "Details",
						rows: [
							{
								id: "row_input_items",
								type: "Input",
								view: {
									content: {
										title: "Item name",
										value: "",
										placeholder: "Enter name",
									},
								},
								destination: "{items}",
								actions: [],
							},
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
		await openAppWithTestFlows(page, [
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
		await openAppWithTestFlows(page, [
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
		await openAppWithTestFlows(page, [
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

		await expect(popup.locator(".evy-condition-logic-row")).toHaveCount(2);

		await popup.getByLabel("Remove condition 1").click();

		await expect(popup.locator(".evy-condition-logic-row")).toHaveCount(1);

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("email not equals name")).toBeVisible();
	});

	test("should discard changes when cancel is clicked", async ({ page }) => {
		await openAppWithTestFlows(page, [
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
		const buttonRow = page.getByText("Cancel Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await expect(configPanel.getByText("If true")).toBeVisible();
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
		await openAppWithTestFlows(page, [
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

	test("should display flat OR conditions in summary", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Button",
						view: { content: { title: "", label: "OR Test" } },
						actions: [
							{
								condition:
									"{count(pickup_timeslots) > 0 || count(delivery_timeslots) > 0}",
								false: "",
								true: "close",
							},
						],
					},
				],
			},
		]);
		const buttonRow = page.getByText("OR Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByText("count(pickup_timeslots) > 0"),
		).toBeVisible();
		await expect(
			configPanel.getByText("or count(delivery_timeslots) > 0"),
		).toBeVisible();
	});

	test("should display nested AND/OR conditions in summary", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Button",
						view: { content: { title: "", label: "Nested Test" } },
						actions: [
							{
								condition:
									"{count(pickup_timeslots) > 0 && (count(delivery_timeslots) > 0 || count(shipping_destination_areas) > 0)}",
								false: "",
								true: "close",
							},
						],
					},
				],
			},
		]);
		const buttonRow = page.getByText("Nested Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByText("count(pickup_timeslots) > 0"),
		).toBeVisible();
		await expect(
			configPanel.getByText(
				"and count(delivery_timeslots) > 0 or count(shipping_destination_areas) > 0",
			),
		).toBeVisible();
	});

	test("should toggle OR to AND in condition editor", async ({ page }) => {
		await openAppWithTestFlows(page, [
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
						view: { content: { title: "", label: "Toggle Test" } },
						actions: [
							{
								condition: "{name == true || email == true}",
								false: "",
								true: "close",
							},
						],
					},
				],
			},
		]);
		const buttonRow = page.getByText("Toggle Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const segmentControl = popup
			.getByTestId("condition-0-logical-toggle")
			.first();
		const orBtn = segmentControl.getByText("OR", { exact: true });
		const andBtn = segmentControl.getByText("AND", { exact: true });

		await expect(orBtn).toHaveClass(/evy-segment-btn--active/);
		await expect(andBtn).toHaveClass(/evy-segment-btn--inactive/);

		await andBtn.click();
		await expect(andBtn).toHaveClass(/evy-segment-btn--active/);
		await expect(orBtn).toHaveClass(/evy-segment-btn--inactive/);

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(configPanel.getByText("and email equals true")).toBeVisible();
	});

	test("should add nested group and round-trip nested condition", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
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
						view: { content: { title: "", label: "Nest Test" } },
						actions: [
							{
								condition: "{name == true || email == true}",
								false: "",
								true: "close",
							},
						],
					},
				],
			},
		]);
		const buttonRow = page.getByText("Nest Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const nestBtn = popup.getByLabel("Add nested group at condition 2");
		await expect(nestBtn).toBeVisible();
		await nestBtn.click();

		const nestedPlaceholderLeft = popup.getByLabel("condition-0-1-1-left");
		await expect(nestedPlaceholderLeft).toBeVisible();

		await popoverSelect(page, nestedPlaceholderLeft, "Name");
		const nestedPlaceholderRight = popup.getByLabel("condition-0-1-1-right");
		await popoverSelect(page, nestedPlaceholderRight, "Email");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await configPanel.getByLabel("Edit action 1").click();
		const popup2 = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup2).toBeVisible();

		const nestedLeafLeft = popup2.getByRole("combobox", {
			name: "condition-0-1-1-left",
			exact: true,
		});
		await expect(nestedLeafLeft).toHaveAttribute("data-value", "name");
	});

	test("navbar breadcrumbs scroll for many nested levels and navigate on click", async ({
		page,
	}) => {
		function deepNest(level: number) {
			if (level === 0) {
				return {
					type: "Input" as const,
					view: {
						content: {
							title: "Deep leaf",
							placeholder: "",
							value: "",
						},
					},
					actions: [],
				};
			}
			return {
				type: "ColumnContainer" as const,
				view: {
					content: {
						title: `Nest level ${level}`,
						children: [deepNest(level - 1)],
					},
				},
				actions: [],
			};
		}

		await openAppWithTestFlows(page, [
			{
				id: "step_deep",
				title: "Deep Page",
				rows: [deepNest(12)],
			},
		]);
		const configPanel = getConfigPanel(page);

		await page.getByText("Nest level 12", { exact: true }).first().click();

		for (let i = 0; i < 11; i++) {
			const nextButton = configPanel.getByRole("button", {
				name: /^ColumnContainer$/,
			});
			await expect(nextButton.first()).toBeVisible();
			await nextButton.first().click();
		}

		await configPanel.getByRole("button", { name: /^Input$/ }).click();

		const breadcrumbScroll = page.getByTestId("nav-breadcrumb-scroll");
		await expect(
			await breadcrumbScroll.evaluate((el) => el.scrollWidth > el.clientWidth),
		).toBe(true);

		await expect(
			page.getByRole("button", {
				name: "Configure nested row at depth 12: Deep leaf",
			}),
		).toBeVisible();

		await page
			.getByRole("button", {
				name: "Configure nested row at depth 5: Nest level 7",
			})
			.click();

		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"Nest level 7",
		);
	});
});
