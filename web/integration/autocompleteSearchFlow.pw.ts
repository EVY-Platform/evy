import { expect, type Locator, test } from "@playwright/test";
import type { UI_Flow as ServerFlow, UI_ActionBranch } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import type { ServiceResource } from "../app/types/resources";
import { openAppWithFullFlows } from "./flowFixtures";
import { getConfigPanel, popoverSelect } from "./utils";

const ITEM_RESOURCE_REF = "test_service.items";
const ORDER_RESOURCE_REF = "test_service.orders";
const MESSAGES_RESOURCE_REF = EVY_CORE_RESOURCE_REF.MESSAGES;

const SERVICE_RESOURCES: ServiceResource[] = [
	{
		id: ITEM_RESOURCE_REF,
		name: "item",
	},
	{
		id: ORDER_RESOURCE_REF,
		name: "order",
	},
	{
		id: MESSAGES_RESOURCE_REF,
		name: "message",
	},
];

const RESOURCE_ATTRIBUTE_METADATA = [
	{
		resourceId: ITEM_RESOURCE_REF,
		attributeNames: ["price", "title"],
	},
	{
		resourceId: ORDER_RESOURCE_REF,
		attributeNames: ["status"],
	},
];

async function readAutocompleteValue(locator: Locator): Promise<string> {
	return locator.inputValue();
}

async function selectAutocompleteOption(
	pageListbox: Locator,
	optionName: string,
): Promise<void> {
	await pageListbox
		.getByRole("option", { name: optionName, exact: true })
		.click();
}

type AutocompleteAction = {
	condition: string;
	false: UI_ActionBranch;
	true: UI_ActionBranch;
};

function buildAutocompleteFlow(
	buttonActions: AutocompleteAction[] = [
		{ condition: "", false: "", true: "" },
	],
): ServerFlow[] {
	return [
		{
			id: "flow-builder",
			name: "Builder Flow",
			submits: {
				resource: ITEM_RESOURCE_REF,
			},
			pages: [
				{
					id: "page-editor",
					title: "Editor",
					rows: [
						{
							id: "row-title",
							type: "input",
							source: `{${ITEM_RESOURCE_REF}}`,
							destination: `{${ITEM_RESOURCE_REF}.title}`,
							title: "Editable title",
							placeholder: "Title",
						},
						{
							id: "row-search",
							type: "search",
							title: "Search messages",
							source: `{${MESSAGES_RESOURCE_REF}}`,
							destination: "",
							placeholder: "Filter messages by type",
							no_results: "No messages found",
						},
						{
							id: "row-mixed",
							type: "text",
							title: "Mixed row",
							subtitle: `None for {${MESSAGES_RESOURCE_REF}}`,
						},
						{
							id: "row-button",
							type: "button",
							title: "",
							label: "Open checkout",
							...(buttonActions.length > 0
								? { actions: { tap: buttonActions } }
								: {}),
						},
					],
				},
				{
					id: "page-checkout",
					title: "Checkout",
					rows: [],
				},
			],
		},
	];
}

async function openAutocompleteFlow(
	page: Parameters<typeof openAppWithFullFlows>[0],
	buttonActions?: AutocompleteAction[],
) {
	await openAppWithFullFlows(
		page,
		buildAutocompleteFlow(buttonActions),
		SERVICE_RESOURCES,
		RESOURCE_ATTRIBUTE_METADATA,
	);
}

test.describe("Autocomplete search flows", () => {
	test("edits a configuration expression with resource and attribute autocomplete", async ({
		page,
	}) => {
		await openAutocompleteFlow(page);

		await page.getByText("Editable title", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		const titleInput = configPanel.getByLabel("title", { exact: true });
		const titleListbox = page.getByRole("listbox", { name: "title" });

		await titleInput.clear();
		await titleInput.pressSequentially("Total: {it");
		await selectAutocompleteOption(titleListbox, ITEM_RESOURCE_REF);

		await expect
			.poll(() => readAutocompleteValue(titleInput))
			.toBe(`Total: {${ITEM_RESOURCE_REF}`);

		await page.keyboard.type(".p");
		await expect(
			titleListbox.getByRole("option", { name: "price", exact: true }),
		).toBeVisible();
		await page.keyboard.press("Enter");
		await page.keyboard.type("}");

		await expect
			.poll(() => readAutocompleteValue(titleInput))
			.toBe(`Total: {${ITEM_RESOURCE_REF}.price}`);
		await expect(titleInput).toHaveValue(
			`Total: {${ITEM_RESOURCE_REF}.price}`,
		);

		await page.getByText("Open checkout", { exact: true }).first().click();
		await page.locator('[data-row-id="row-title"]').first().click();

		const reopenedTitleInput = configPanel.getByLabel("title", {
			exact: true,
		});
		await expect
			.poll(() => readAutocompleteValue(reopenedTitleInput))
			.toBe(`Total: {${ITEM_RESOURCE_REF}.price}`);
	});

	test("edits source, destination, and visible binding expressions", async ({
		page,
	}) => {
		await openAutocompleteFlow(page);

		await page.getByText("Editable title", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);

		const sourceInput = configPanel.getByLabel("Row data source");
		await sourceInput.click();
		await sourceInput.press("ControlOrMeta+A");
		await sourceInput.pressSequentially("{it");
		await selectAutocompleteOption(
			page.getByRole("listbox", { name: "Row data source" }),
			ITEM_RESOURCE_REF,
		);
		await page.keyboard.type("}");
		await expect
			.poll(() => readAutocompleteValue(sourceInput))
			.toBe(`{${ITEM_RESOURCE_REF}}`);

		const visibleInput = configPanel.getByLabel("Row visibility condition");
		await visibleInput.clear();
		await visibleInput.pressSequentially("{$datum.p");
		const visibleListbox = page.getByRole("listbox", {
			name: "Row visibility condition",
		});
		await expect(
			visibleListbox.getByRole("option", { name: "price", exact: true }),
		).toBeVisible();
		await expect(
			visibleListbox.getByRole("option", { name: "status", exact: true }),
		).toHaveCount(0);
		await page.keyboard.press("Enter");
		await page.keyboard.type(" > 0");
		await expect
			.poll(() => readAutocompleteValue(visibleInput))
			.toBe("{$datum.price > 0");

		const destinationInput = configPanel.getByLabel("Row destination");
		await destinationInput.clear();
		await destinationInput.pressSequentially("{or");
		await selectAutocompleteOption(
			page.getByRole("listbox", { name: "Row destination" }),
			ORDER_RESOURCE_REF,
		);
		await page.keyboard.type("}");
		await expect
			.poll(() => readAutocompleteValue(destinationInput))
			.toBe(`{${ORDER_RESOURCE_REF}}`);

		await page.getByText("Open checkout", { exact: true }).first().click();
		await page.getByText("Editable title", { exact: true }).first().click();

		await expect
			.poll(() =>
				readAutocompleteValue(
					configPanel.getByLabel("Row visibility condition"),
				),
			)
			.toBe("{$datum.price > 0");
		await expect(configPanel.getByLabel("Row destination")).toHaveValue(
			`{${ORDER_RESOURCE_REF}}`,
		);
	});

	test("configures action branches with PopoverSelect arguments and persists them", async ({
		page,
	}) => {
		await openAutocompleteFlow(page);

		await page.getByText("Open checkout", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		await popoverSelect(
			page,
			popup.getByLabel("true-0-function"),
			"Navigate",
		);

		const flowArg = popup.getByLabel("true-0-arg-0");
		await expect(flowArg).toBeVisible();
		await popoverSelect(page, flowArg, "Builder Flow");
		await expect(flowArg).toHaveAttribute("data-value", "flow-builder");

		const pageArg = popup.getByLabel("true-0-arg-1");
		await expect(pageArg).toBeVisible();
		await popoverSelect(page, pageArg, "Checkout");
		await expect(pageArg).toHaveAttribute("data-value", "page-checkout");

		const queryParams = popup.getByLabel("true-0-navigate-query");
		await expect(queryParams).toBeVisible();
		await queryParams.fill("{items: [$datum.id]}");

		await popoverSelect(
			page,
			popup.getByLabel("false-0-function"),
			"Create",
		);

		const resourceArg = popup.getByLabel("false-0-arg-0");
		await expect(resourceArg).toBeVisible();
		await popoverSelect(page, resourceArg, "Item");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText(
				"navigate(Builder Flow, Checkout, {items: [$datum.id]})",
			),
		).toBeVisible();
		await expect(
			configPanel.getByText(`create(${ITEM_RESOURCE_REF}, submit)`, {
				exact: true,
			}),
		).toBeVisible();

		await configPanel.getByLabel("Edit action 1").click();
		const reopenedPopup = page.getByRole("dialog", {
			name: "Edit action 1",
		});
		await expect(reopenedPopup).toBeVisible();
		await expect(
			reopenedPopup.getByLabel("true-0-function"),
		).toHaveAttribute("data-value", "navigate");
		await expect(reopenedPopup.getByLabel("true-0-arg-0")).toHaveAttribute(
			"data-value",
			"flow-builder",
		);
		await expect(reopenedPopup.getByLabel("true-0-arg-1")).toHaveAttribute(
			"data-value",
			"page-checkout",
		);
		await expect
			.poll(() =>
				readAutocompleteValue(
					reopenedPopup.getByLabel("true-0-navigate-query"),
				),
			)
			.toBe("{items: [$datum.id]}");
	});

	test("keeps prose matching a resource id as plain text in content fields", async ({
		page,
	}) => {
		await openAutocompleteFlow(page);

		await page
			.getByText("Search messages", { exact: true })
			.first()
			.click();
		const configPanel = getConfigPanel(page);

		const noResults = configPanel.getByLabel("no_results", { exact: true });
		await expect(noResults).toHaveValue("No messages found");
		await expect
			.poll(() => readAutocompleteValue(noResults))
			.toBe("No messages found");

		const placeholder = configPanel.getByLabel("placeholder", {
			exact: true,
		});
		await expect(placeholder).toHaveValue("Filter messages by type");
		await expect
			.poll(() => readAutocompleteValue(placeholder))
			.toBe("Filter messages by type");
	});

	test("shows raw resource refs in bindings and interpolations", async ({
		page,
	}) => {
		await openAutocompleteFlow(page);

		await page
			.getByText("Search messages", { exact: true })
			.first()
			.click();
		const configPanel = getConfigPanel(page);

		const sourceInput = configPanel.getByLabel("Row data source");
		await expect(sourceInput).toHaveValue(`{${MESSAGES_RESOURCE_REF}}`);

		await page.getByText("Mixed row", { exact: true }).first().click();
		const subtitle = configPanel.getByLabel("subtitle", { exact: true });
		await expect(subtitle).toHaveValue(
			`None for {${MESSAGES_RESOURCE_REF}}`,
		);
		await expect
			.poll(() => readAutocompleteValue(subtitle))
			.toBe(`None for {${MESSAGES_RESOURCE_REF}}`);
	});

	test("shows raw resource refs in update() argument fields", async ({
		page,
	}) => {
		await openAutocompleteFlow(page, [
			{
				condition: "",
				false: "",
				true: {
					fn: "update",
					resource: ITEM_RESOURCE_REF,
					mode: "store",
					filter: {
						fk: `${ITEM_RESOURCE_REF}.id`,
						closedAt: "null",
					},
					changes: {
						closedAt: "now()",
					},
				},
			},
		]);

		await page.getByText("Open checkout", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		const filterField = popup.getByLabel("true-0-update-filter");
		await expect
			.poll(() => readAutocompleteValue(filterField))
			.toBe(`{fk: ${ITEM_RESOURCE_REF}.id, closedAt: null}`);
		await expect(filterField).toHaveValue(
			`{fk: ${ITEM_RESOURCE_REF}.id, closedAt: null}`,
		);

		const changesField = popup.getByLabel("true-0-update-changes");
		await expect
			.poll(() => readAutocompleteValue(changesField))
			.toBe("{closedAt: now()}");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText(
				`update(${ITEM_RESOURCE_REF}, {fk: ${ITEM_RESOURCE_REF}.id, closedAt: null}, {closedAt: now()})`,
				{ exact: true },
			),
		).toBeVisible();
	});
});
