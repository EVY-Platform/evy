import { expect, test } from "@playwright/test";
import type { UI_RowActions } from "evy-types";
import {
	TEST_RESOURCE_ID,
	TEST_SERVICE_ID,
} from "../testFixtures/resourceCatalog";
import { initFullFlows, openAppWithTestFlows, tapAction } from "./flowFixtures";
import {
	getConfigPanel,
	getPageContent,
	getSidebarRow,
	popoverSelect,
	setupTwoEmptyTestPages,
} from "./utils";

const TEST_SERVICE_RESOURCES = [
	{
		id: TEST_RESOURCE_ID.RECORDS,
		serviceId: TEST_SERVICE_ID,
		name: "item",
	},
];

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
						type: "horizontal_container",
						title: "Container Row",
						children: [
							{
								type: "input",
								title: "Input Row",
								placeholder: "First placeholder",
							},
						],
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
			configPanel.getByRole("button", { name: /^Input Row: Input$/ }),
		).toBeVisible();

		await configPanel
			.getByRole("button", { name: /^Input Row: Input$/ })
			.click();

		await expect(configPanel.getByLabel("Page title")).toHaveCount(0);
		await expect(
			page.getByRole("button", {
				name: "Configure nested row at depth 1: Input Row",
			}),
		).toBeVisible();
		await expect(configPanel.getByLabel("placeholder")).toHaveText(
			"First placeholder",
		);
		await expect(configPanel.getByLabel("title")).toHaveText("Input Row");
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
						type: "text",
						title: "Test Text Row",
						subtitle: "Initial subtitle content",
					},
				],
			},
		]);
		const textRow = page
			.getByText("Test Text Row", { exact: true })
			.first();
		await expect(textRow).toBeVisible();
		await textRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByLabel("subtitle")).toBeVisible();

		const subtitleInput = configPanel.getByLabel("subtitle");
		await subtitleInput.clear();
		await subtitleInput.fill("Updated subtitle text");

		await expect(subtitleInput).toHaveText("Updated subtitle text");
	});

	test("should display and edit Source binding in configuration panel", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "input",
						source: "{initial}",
						title: "Binding row",
						placeholder: "Enter value",
					},
				],
			},
		]);
		await page.getByText("Binding row", { exact: true }).first().click();

		const configPanel = getConfigPanel(page);
		const sourceInput = configPanel.getByLabel("Row data source");
		await expect(sourceInput).toBeVisible();
		await expect(sourceInput).toHaveText("{initial}");

		await sourceInput.clear();
		await sourceInput.fill("{items}");

		await expect(sourceInput).toHaveText("{items}");
	});

	test("should display and edit no_results text on a Search row in configuration panel", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "search",
						source: "{$api:place_search}",
						destination: "{selected_item}",
						title: "Search row",
						placeholder: "Search address",
					},
				],
			},
		]);
		await page.getByText("Search row", { exact: true }).first().click();

		const configPanel = getConfigPanel(page);
		const noResultsInput = configPanel.getByLabel("no_results", {
			exact: true,
		});
		await expect(noResultsInput).toBeVisible();
		await expect(noResultsInput).toHaveText("");

		await noResultsInput.fill("No addresses found");

		await expect(noResultsInput).toHaveText("No addresses found");
	});

	test("should display InputList format in configuration panel", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "input_list",
						title: "Selling Reasons",
						placeholder: "Search for reasons",
						format: "{$datum.value}",
					},
				],
			},
		]);
		await page
			.getByText("Selling Reasons", { exact: true })
			.first()
			.click();

		const configPanel = getConfigPanel(page);
		const formatInput = configPanel.getByLabel("format");
		await expect(formatInput).toBeVisible();
		await expect(formatInput).toHaveText("{$datum.value}");

		await formatInput.clear();
		await formatInput.fill("{$datum.label}");

		await expect(formatInput).toHaveText("{$datum.label}");
	});

	// The declaration is one value, not two: the schema requires a non-empty
	// resource, so picking a service on its own is not a state a flow can be
	// saved in.
	test("flow submits declaration can be set and cleared as one target", async ({
		page,
	}) => {
		await openAppWithTestFlows(
			page,
			[
				{
					id: "step_1",
					title: "Test Page",
					rows: [
						{
							type: "text",
							title: "Hello",
							visible: "true",
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);

		await page.getByText("Hello", { exact: true }).first().click();

		const configPanel = getConfigPanel(page);
		const targetSelect = configPanel.getByLabel("Flow submits target");

		await expect(targetSelect).toBeVisible();
		await expect(targetSelect).toHaveAttribute("data-value", "");

		await popoverSelect(page, targetSelect, "Item");
		await expect(targetSelect).toHaveAttribute(
			"data-value",
			TEST_RESOURCE_ID.RECORDS,
		);

		await popoverSelect(page, targetSelect, "None");
		await expect(targetSelect).toHaveAttribute("data-value", "");
	});

	test("action popup traps focus and is announced as a modal dialog", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Test Button",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);
		await page.getByText("Test Button", { exact: true }).first().click();
		await getConfigPanel(page).getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();
		await expect(popup).toHaveAttribute("aria-modal", "true");

		// Focus starts inside the dialog rather than on the page behind it.
		await expect
			.poll(() =>
				popup.evaluate((panel) =>
					panel.contains(document.activeElement),
				),
			)
			.toBe(true);

		// Tabbing all the way round stays inside the dialog instead of
		// escaping into the builder underneath.
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press("Tab");
		}
		expect(
			await popup.evaluate((panel) =>
				panel.contains(document.activeElement),
			),
		).toBe(true);

		await page.keyboard.press("Escape");
		await expect(popup).toBeHidden();
	});

	test("should display and edit action items via popup", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Test Button",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);
		const buttonRow = page
			.getByText("Test Button", { exact: true })
			.first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(configPanel.getByText("Tap")).toBeVisible();
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
		await expect(falseFunctionSelect).toHaveAttribute(
			"data-value",
			"close",
		);

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
						type: "button",
						title: "",
						label: "Nav Button",
						actions: tapAction({ fn: "close" }),
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
		await initFullFlows(
			page,
			[
				{
					id: "flow_conditions",
					name: "Condition Flow",
					pages: [
						{
							id: "step_1",
							title: "Test Page",
							rows: [
								{
									id: "name_input",
									type: "input",
									source: "",
									title: "Name",
									value: `{${TEST_RESOURCE_ID.RECORDS}.name}`,
									placeholder: "Enter name",
									destination: `{${TEST_RESOURCE_ID.RECORDS}.name}`,
								},
								{
									id: "submit_button",
									type: "button",
									source: "",
									title: "",
									label: "Submit",
									actions: {
										tap: [
											{
												condition: "",
												false: "",
												true: { fn: "close" },
											},
										],
									},
								},
							],
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);
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

		await popoverSelect(page, leftOperand, "Item.name");
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

		await expect(committedLeft).toHaveAttribute(
			"data-value",
			`${TEST_RESOURCE_ID.RECORDS}.name`,
		);
		await expect(committedOp).toHaveAttribute("data-value", "!=");
		await expect(committedRight).toHaveAttribute(
			"data-value",
			"__boolean__",
		);

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("item.name not equals true"),
		).toBeVisible();
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
						type: "text",
						title: "No Action Row",
						subtitle: "Some subtitle",
					},
				],
			},
		]);
		const textRow = page
			.getByText("No Action Row", { exact: true })
			.first();
		await expect(textRow).toBeVisible();
		await textRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByText("Tap", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByText("No tap actions")).toBeVisible();
	});

	test("should use number operand in condition", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "input",
						title: "Price",
						value: "{price}",
						placeholder: "",
						destination: "{price}",
					},
					{
						type: "button",
						title: "",
						label: "Check",
						actions: tapAction({ fn: "close" }),
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
						type: "input",
						title: "Items",
						value: "{items}",
						placeholder: "",
						destination: "{items}",
					},
					{
						type: "button",
						title: "",
						label: "Validate",
						actions: tapAction({ fn: "close" }),
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

		await popoverSelect(page, leftOperand, "count");

		const fnArgField = popup.getByLabel("condition-0-0-left-arg");
		await expect(fnArgField).toBeVisible();
		await fnArgField.click();
		await fnArgField.pressSequentially("items");

		await popoverSelect(page, rightOperand, "Items");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("count(items) equals items"),
		).toBeVisible();
	});

	test("should add multiple OR conditions and remove one", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "input",
						title: "Name",
						value: "{name}",
						placeholder: "",
						destination: "{name}",
					},
					{
						type: "input",
						title: "Email",
						value: "{email}",
						placeholder: "",
						destination: "{email}",
					},
					{
						type: "button",
						title: "",
						label: "Send",
						actions: tapAction({ fn: "close" }),
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

		await expect(
			configPanel.getByText("email not equals name"),
		).toBeVisible();
	});

	test("should discard changes when cancel is clicked", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Cancel Test",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);
		const buttonRow = page
			.getByText("Cancel Test", { exact: true })
			.first();
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
						type: "button",
						title: "",
						label: "Multi Action",
						actions: {
							tap: [
								{
									condition: "",
									false: "",
									true: { fn: "close" },
								},
								{
									condition: "",
									false: "",
									true: {
										fn: "create",
										resource: TEST_RESOURCE_ID.RECORDS,
										mode: "submit",
									},
								},
							],
						},
					},
				],
			},
		]);
		const buttonRow = page
			.getByText("Multi Action", { exact: true })
			.first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(configPanel.getByText("Action 1")).toBeVisible();
		await expect(configPanel.getByText("Action 2")).toBeVisible();

		await configPanel.getByLabel("Remove action 1").click();

		await expect(configPanel.getByText("Action 1")).toBeVisible();
		await expect(configPanel.getByText("Action 2")).not.toBeVisible();
	});

	test("should use inline create when the flow has no draft signals", async ({
		page,
	}) => {
		await openAppWithTestFlows(
			page,
			[
				{
					title: "Create Page",
					rows: [
						{
							type: "button",
							title: "",
							label: "Inline Create",
							actions: tapAction({
								fn: "create",
								resource: TEST_RESOURCE_ID.RECORDS,
								mode: "submit",
							}),
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);

		await page.getByText("Inline Create", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const createDataField = popup.getByLabel("true-0-create-data");
		await expect(createDataField).toBeVisible();
		await createDataField.fill("pickup_address");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("create(item, pickup_address)", {
				exact: true,
			}),
		).toBeVisible();
	});

	test("should not save submit create without inline data when draft signals are absent", async ({
		page,
	}) => {
		await openAppWithTestFlows(
			page,
			[
				{
					title: "Create Page",
					rows: [
						{
							type: "button",
							title: "",
							label: "Inline Create",
							actions: tapAction({
								fn: "create",
								resource: TEST_RESOURCE_ID.RECORDS,
								mode: "submit",
							}),
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);

		await page.getByText("Inline Create", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();
		await expect(
			popup.getByRole("button", { name: "Save" }),
		).toBeDisabled();

		await popup.getByRole("button", { name: "Cancel" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("create(item, submit)", {
				exact: true,
			}),
		).toBeVisible();
	});

	test("should use submit create when the flow declares submits", async ({
		page,
	}) => {
		await openAppWithTestFlows(
			page,
			[
				{
					title: "Create Page",
					rows: [
						{
							type: "input",
							title: "Title",
							value: "",
							placeholder: "",
							destination: `{${TEST_RESOURCE_ID.RECORDS}.title}`,
						},
						{
							type: "button",
							title: "",
							label: "Submit Create",
							actions: tapAction({
								fn: "create",
								resource: TEST_RESOURCE_ID.RECORDS,
								mode: "submit",
							}),
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
			[],
			{
				resource: TEST_RESOURCE_ID.RECORDS,
			},
		);

		await page.getByText("Submit Create", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();
		await expect(
			popup.getByText("Creates from row destinations and draft updates"),
		).toBeVisible();
		await expect(popup.getByLabel("true-0-create-data")).not.toBeVisible();

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText("create(item, submit)", {
				exact: true,
			}),
		).toBeVisible();
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
								type: "input",
								source: "",
								title: "Name",
								value: "{name}",
								placeholder: "",
								destination: "{name}",
							},
							{
								id: "row_btn",
								type: "button",
								source: "",
								title: "",
								label: "Prefilled",
								actions: {
									tap: [
										{
											condition: "{name == true}",
											true: {
												fn: "navigate",
												flow_id: "flow_x",
												page_id: "page_x",
											},
											false: { fn: "close" },
										},
									],
								},
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
		await initFullFlows(
			page,
			[
				{
					id: "flow_or_summary",
					name: "OR Summary Flow",
					pages: [
						{
							id: "step_1",
							title: "Test Page",
							rows: [
								{
									id: "or_test_button",
									type: "button",
									source: "",
									title: "",
									label: "OR Test",
									actions: {
										tap: [
											{
												condition: `{count(${TEST_RESOURCE_ID.RECORDS}.pickup_timeslots) > 0 || count(${TEST_RESOURCE_ID.RECORDS}.delivery_timeslots) > 0}`,
												false: "",
												true: { fn: "close" },
											},
										],
									},
								},
							],
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);
		await page.goto("/");
		const buttonRow = page.getByText("OR Test", { exact: true }).first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByText("count(item.pickup_timeslots) > 0"),
		).toBeVisible();
		await expect(
			configPanel.getByText("or count(item.delivery_timeslots) > 0"),
		).toBeVisible();
	});

	test("should display nested AND/OR conditions in summary", async ({
		page,
	}) => {
		await initFullFlows(
			page,
			[
				{
					id: "flow_nested_summary",
					name: "Nested Summary Flow",
					pages: [
						{
							id: "step_1",
							title: "Test Page",
							rows: [
								{
									id: "nested_test_button",
									type: "button",
									source: "",
									title: "",
									label: "Nested Test",
									actions: {
										tap: [
											{
												condition: `{count(${TEST_RESOURCE_ID.RECORDS}.pickup_timeslots) > 0 && (count(${TEST_RESOURCE_ID.RECORDS}.delivery_timeslots) > 0 || count(${TEST_RESOURCE_ID.RECORDS}.shipping_destination_areas) > 0)}`,
												false: "",
												true: { fn: "close" },
											},
										],
									},
								},
							],
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);
		await page.goto("/");
		const buttonRow = page
			.getByText("Nested Test", { exact: true })
			.first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(
			configPanel.getByText("count(item.pickup_timeslots) > 0"),
		).toBeVisible();
		await expect(
			configPanel.getByText(
				"and count(item.delivery_timeslots) > 0 or count(item.shipping_destination_areas) > 0",
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
						type: "input",
						title: "Name",
						value: "{name}",
						placeholder: "",
						destination: "{name}",
					},
					{
						type: "input",
						title: "Email",
						value: "{email}",
						placeholder: "",
						destination: "{email}",
					},
					{
						type: "button",
						title: "",
						label: "Toggle Test",
						actions: {
							tap: [
								{
									condition:
										"{name == true || email == true}",
									false: "",
									true: { fn: "close" },
								},
							],
						},
					},
				],
			},
		]);
		const buttonRow = page
			.getByText("Toggle Test", { exact: true })
			.first();
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

		await expect(
			configPanel.getByText("and email equals true"),
		).toBeVisible();
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
						type: "input",
						title: "Name",
						value: "{name}",
						placeholder: "",
						destination: "{name}",
					},
					{
						type: "input",
						title: "Email",
						value: "{email}",
						placeholder: "",
						destination: "{email}",
					},
					{
						type: "button",
						title: "",
						label: "Nest Test",
						actions: {
							tap: [
								{
									condition:
										"{name == true || email == true}",
									false: "",
									true: { fn: "close" },
								},
							],
						},
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
		const nestedPlaceholderRight = popup.getByLabel(
			"condition-0-1-1-right",
		);
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
		type DeepNestRow = {
			type: "input" | "horizontal_container";
			title: string;
			placeholder?: string;
			value?: string;
			children?: DeepNestRow[];
			actions: UI_RowActions;
		};

		function deepNest(level: number): DeepNestRow {
			if (level === 0) {
				return {
					type: "input",
					title: "Deep leaf",
					placeholder: "",
					value: "",
				};
			}
			return {
				type: "horizontal_container",
				title: `Nest level ${level}`,
				children: [deepNest(level - 1)],
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
				name: /: HorizontalContainer$/,
			});
			await expect(nextButton.first()).toBeVisible();
			await nextButton.first().click();
		}

		await configPanel.getByRole("button", { name: /: Input$/ }).click();

		const breadcrumbScroll = page.getByTestId("nav-breadcrumb-scroll");
		await expect(
			await breadcrumbScroll.evaluate(
				(el) => el.scrollWidth > el.clientWidth,
			),
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

		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toHaveText("Nest level 7");
	});

	test("should clear a branch by selecting -- and persist on save", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Clear Branch",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);
		const buttonRow = page
			.getByText("Clear Branch", { exact: true })
			.first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		// Verify the existing true branch is shown
		await expect(configPanel.getByText("If true")).toBeVisible();
		await expect(configPanel.getByText("Close")).toBeVisible();

		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		// Verify true branch is set to close
		const trueFunctionSelect = popup.getByLabel("true-0-function");
		await expect(trueFunctionSelect).toHaveAttribute("data-value", "close");

		// Select -- to clear the true branch
		await popoverSelect(page, trueFunctionSelect, "--");
		await expect(trueFunctionSelect).toHaveAttribute("data-value", "");

		// Nested controls should be gone
		await expect(popup.getByLabel("true-0-arg-0")).not.toBeVisible();

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		// After save, the true branch summary should be gone
		await expect(configPanel.getByText("If true")).not.toBeVisible();
		await expect(configPanel.getByText("Close")).not.toBeVisible();

		// Reopen and verify the branch is still empty
		await configPanel.getByLabel("Edit action 1").click();
		const reopenedPopup = page.getByRole("dialog", {
			name: "Edit action 1",
		});
		await expect(reopenedPopup).toBeVisible();
		await expect(
			reopenedPopup.getByLabel("true-0-function"),
		).toHaveAttribute("data-value", "");
	});

	test("should not persist branch clear when cancel is clicked after selecting --", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Cancel Clear",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);
		const buttonRow = page
			.getByText("Cancel Clear", { exact: true })
			.first();
		await expect(buttonRow).toBeVisible();
		await buttonRow.click();

		const configPanel = getConfigPanel(page);

		await expect(configPanel.getByText("If true")).toBeVisible();
		await expect(configPanel.getByText("Close")).toBeVisible();

		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const trueFunctionSelect = popup.getByLabel("true-0-function");
		await expect(trueFunctionSelect).toHaveAttribute("data-value", "close");

		// Select -- to clear the true branch
		await popoverSelect(page, trueFunctionSelect, "--");
		await expect(trueFunctionSelect).toHaveAttribute("data-value", "");

		// Cancel the popup
		await popup.getByRole("button", { name: "Cancel" }).click();
		await expect(popup).not.toBeVisible();

		// The original branch should still be shown in the summary
		await expect(configPanel.getByText("If true")).toBeVisible();
		await expect(configPanel.getByText("Close")).toBeVisible();

		// Reopen and verify the original branch is preserved
		await configPanel.getByLabel("Edit action 1").click();
		const reopenedPopup = page.getByRole("dialog", {
			name: "Edit action 1",
		});
		await expect(reopenedPopup).toBeVisible();
		await expect(
			reopenedPopup.getByLabel("true-0-function"),
		).toHaveAttribute("data-value", "close");
	});

	test("should display and edit initial value for supported row in configuration panel", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "input",
						source: "{title}",
						destination: "{title}",
						title: "Initial value row",
						placeholder: "Enter a title",
						initial: "Default title",
					},
				],
			},
		]);
		await page
			.getByText("Initial value row", { exact: true })
			.first()
			.click();

		const configPanel = getConfigPanel(page);
		const initialInput = configPanel.getByLabel("initial");
		await expect(initialInput).toBeVisible();
		await expect(initialInput).toHaveText("Default title");

		await initialInput.fill("Updated default");

		await expect(initialInput).toHaveText("Updated default");
	});

	test("selecting Show defaults to the configured row sheet id", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "button",
						title: "Open Sheet",
						label: "Open",
						sheet: {
							type: "text",
							title: "Sheet Content",
							text: "Inside sheet",
						},
					},
				],
			},
		]);

		await page.getByText("Open Sheet", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByRole("button", { name: "Add action" }).click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		const trueFunctionSelect = popup.getByLabel("true-0-function");
		await popoverSelect(page, trueFunctionSelect, "Show row");

		const rowArgSelect = popup.getByLabel("true-0-arg-0");
		await expect(rowArgSelect).toHaveAttribute("data-value", /.+/);
		const selectedRowId = await rowArgSelect.getAttribute("data-value");
		expect(selectedRowId).toBeTruthy();
	});

	test("Show row target can be changed to a row on another page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "button",
						title: "Trigger",
						label: "Go",
						sheet: {
							type: "text",
							title: "Local Sheet",
							text: "Local",
						},
					},
				],
			},
			{
				id: "step_2",
				title: "Page 2",
				rows: [
					{
						type: "text",
						title: "Remote Target Row",
						text: "Remote",
					},
				],
			},
		]);

		await page.getByText("Trigger", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByRole("button", { name: "Add action" }).click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		const trueFunctionSelect = popup.getByLabel("true-0-function");
		await popoverSelect(page, trueFunctionSelect, "Show row");

		const rowArgSelect = popup.getByLabel("true-0-arg-0");
		await popoverSelect(
			page,
			rowArgSelect,
			"Test Flow / Page 2 / Remote Target Row",
		);

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(configPanel.getByText(/show\(/)).toBeVisible();
		await expect(configPanel.getByText(/Remote Target Row/)).toBeVisible();
	});

	test("shows Tap only for Button and Tap plus Delete for SelectPhoto", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Trigger Button",
						actions: tapAction({ fn: "close" }),
					},
					{
						type: "select_photo",
						title: "Photos",
						subtitle: "0/10",
						icon: "::image-plus::",
						content: "Add",
						actions: {
							tap: [
								{
									condition: "",
									false: "",
									true: { fn: "select_photo" },
								},
							],
							delete: [
								{
									condition: "",
									false: "",
									true: { fn: "delete_photo" },
								},
							],
						},
					},
				],
			},
		]);

		const configPanel = getConfigPanel(page);
		await page.getByText("Trigger Button", { exact: true }).click();
		await expect(
			configPanel.getByText("Tap", { exact: true }),
		).toBeVisible();
		await expect(
			configPanel.getByText("Delete", { exact: true }),
		).not.toBeVisible();

		await page.getByText("Photos", { exact: true }).click();
		await expect(
			configPanel.getByText("Tap", { exact: true }),
		).toBeVisible();
		await expect(
			configPanel.getByText("Delete", { exact: true }),
		).toBeVisible();
	});

	test("shows required warning after removing the last tap action", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "button",
						title: "",
						label: "Warn Button",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);
		await page.getByText("Warn Button", { exact: true }).click();
		const configPanel = getConfigPanel(page);
		await expect(configPanel.getByText("(required)")).toBeVisible();
		await configPanel
			.getByRole("button", { name: "Remove action 1" })
			.click();
		await expect(
			configPanel.getByText("This trigger needs at least one action."),
		).toBeVisible();
		await expect(configPanel.getByText("No tap actions")).toBeVisible();
	});

	test("injects show-self tap default when dropping a Dropdown row", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);
		const sidebarRow = await getSidebarRow(page, "Dropdown row title");
		const pageContent = getPageContent(page);
		await sidebarRow.dragTo(pageContent);

		const configPanel = getConfigPanel(page);
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toHaveText("Dropdown row title");
		await expect(
			configPanel.getByText("Tap", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByText("No tap actions")).not.toBeVisible();
		await expect(
			configPanel.getByText(/show\(.*Dropdown row title/),
		).toBeVisible();
	});

	test("shows Tap, Tap row, and Tap column for Calendar with required badges", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);
		const sidebarRow = await getSidebarRow(page, "Calendar row title");
		const pageContent = getPageContent(page);
		await sidebarRow.dragTo(pageContent);

		const configPanel = getConfigPanel(page);
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toHaveText("Calendar row title");
		await expect(
			configPanel.getByText("Tap", { exact: true }),
		).toBeVisible();
		await expect(
			configPanel.getByText("Tap row", { exact: true }),
		).toBeVisible();
		await expect(
			configPanel.getByText("Tap column", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByText("(required)")).toHaveCount(3);
		await expect(configPanel.getByText(/select\(\$datum\)/)).toHaveCount(3);
	});

	test("shows Swipe left for Text without required badge, not for Button", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "text",
						title: "Slide Text",
						subtitle: "",
					},
					{
						type: "button",
						title: "",
						label: "Slide Button",
						actions: tapAction({ fn: "close" }),
					},
				],
			},
		]);

		const configPanel = getConfigPanel(page);
		await page.getByText("Slide Text", { exact: true }).click();
		await expect(
			configPanel.getByText("Swipe left", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByText("(required)")).toHaveCount(0);
		await expect(
			configPanel.getByText("No swipe left actions"),
		).toBeVisible();

		await page.getByText("Slide Button", { exact: true }).click();
		await expect(
			configPanel.getByText("Swipe left", { exact: true }),
		).not.toBeVisible();
	});
});
