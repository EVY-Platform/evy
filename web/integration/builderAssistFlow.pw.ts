import { expect, type Locator, test } from "@playwright/test";
import type { UI_Flow as ServerFlow, UI_ActionBranch } from "evy-types";
import type { ServiceResource } from "../app/types/resources";
import { TEST_SERVICE_ID } from "../testFixtures/resourceCatalog";
import { openAppWithFullFlows } from "./flowFixtures";
import { getConfigPanel, popoverSelect } from "./utils";

const ITEM_RESOURCE_ID = "res-item";
const ORDER_RESOURCE_ID = "res-order";
// Core resources are identified by plural words and named by the singular, so
// their ids collide with ordinary prose (types/generated/ts/coreResources.ts).
const MESSAGES_RESOURCE_ID = "messages";

const SERVICE_RESOURCES: ServiceResource[] = [
	{
		id: ITEM_RESOURCE_ID,
		serviceId: TEST_SERVICE_ID,
		name: "item",
	},
	{
		id: ORDER_RESOURCE_ID,
		serviceId: TEST_SERVICE_ID,
		name: "order",
	},
	{
		id: MESSAGES_RESOURCE_ID,
		serviceId: TEST_SERVICE_ID,
		name: "message",
	},
];

const RESOURCE_ATTRIBUTE_METADATA = [
	{
		serviceId: TEST_SERVICE_ID,
		resourceId: ITEM_RESOURCE_ID,
		attributeNames: ["price", "title"],
	},
	{
		serviceId: TEST_SERVICE_ID,
		resourceId: ORDER_RESOURCE_ID,
		attributeNames: ["status"],
	},
];

async function readBuilderAssistRawValue(locator: Locator): Promise<string> {
	return locator.evaluate((el) => {
		if ("value" in el) return (el as HTMLInputElement).value;

		function readNode(node: Node): string {
			if (node.nodeType === Node.TEXT_NODE)
				return (node.textContent ?? "").replace(/\u00a0/g, " ");
			if (node instanceof HTMLElement && node.dataset.value)
				return node.dataset.value;
			let result = "";
			for (const child of node.childNodes) result += readNode(child);
			return result;
		}

		return readNode(el);
	});
}

async function selectBuilderAssistOption(
	pageListbox: Locator,
	optionName: string,
): Promise<void> {
	await pageListbox
		.getByRole("option", { name: optionName, exact: true })
		.click();
}

function getBuilderAssistToken(field: Locator, text: string): Locator {
	return field.locator(".evy-id-autocomplete-inline-token", {
		hasText: text,
	});
}

type BuilderAssistAction = {
	condition: string;
	false: UI_ActionBranch;
	true: UI_ActionBranch;
};

function buildBuilderAssistFlow(
	buttonActions: BuilderAssistAction[] = [
		{ condition: "", false: "", true: "" },
	],
): ServerFlow[] {
	return [
		{
			id: "flow-builder",
			name: "Builder Flow",
			submits: {
				service: TEST_SERVICE_ID,
				resource: ITEM_RESOURCE_ID,
			},
			pages: [
				{
					id: "page-editor",
					title: "Editor",
					rows: [
						{
							id: "row-title",
							type: "Input",
							source: `{${ITEM_RESOURCE_ID}}`,
							destination: `{${ITEM_RESOURCE_ID}.title}`,
							title: "Editable title",
							placeholder: "Title",
						},
						{
							id: "row-search",
							type: "Search",
							title: "Search messages",
							source: `{${MESSAGES_RESOURCE_ID}}`,
							destination: "",
							placeholder: "Filter messages by type",
							no_results: "No messages found",
						},
						{
							id: "row-mixed",
							type: "Text",
							title: "Mixed row",
							subtitle: `None for {${MESSAGES_RESOURCE_ID}}`,
						},
						{
							id: "row-button",
							type: "Button",
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

async function openBuilderAssistFlow(
	page: Parameters<typeof openAppWithFullFlows>[0],
	buttonActions?: BuilderAssistAction[],
) {
	await openAppWithFullFlows(
		page,
		buildBuilderAssistFlow(buttonActions),
		SERVICE_RESOURCES,
		RESOURCE_ATTRIBUTE_METADATA,
	);
}

test.describe("Builder Assist flows", () => {
	test("edits a configuration expression with resource and attribute chips", async ({
		page,
	}) => {
		await openBuilderAssistFlow(page);

		await page.getByText("Editable title", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		const titleInput = configPanel.getByLabel("title", { exact: true });
		const titleListbox = page.getByRole("listbox", { name: "title" });

		await titleInput.clear();
		await titleInput.pressSequentially("Total: {it");
		await selectBuilderAssistOption(titleListbox, "item");

		const itemToken = getBuilderAssistToken(titleInput, "item");
		await expect(itemToken).toBeVisible();
		await expect(itemToken).toHaveAttribute("data-value", ITEM_RESOURCE_ID);
		await expect
			.poll(() => readBuilderAssistRawValue(titleInput))
			.toBe(`Total: {${ITEM_RESOURCE_ID}`);

		await page.keyboard.type(".p");
		await expect(
			titleListbox.getByRole("option", { name: "price", exact: true }),
		).toBeVisible();
		await page.keyboard.press("Enter");
		await page.keyboard.type("}");

		await expect
			.poll(() => readBuilderAssistRawValue(titleInput))
			.toBe(`Total: {${ITEM_RESOURCE_ID}.price}`);
		await expect(itemToken).toBeVisible();
		await expect(
			page.getByText("Total: item.price", { exact: true }),
		).toBeVisible();

		await page.getByText("Open checkout", { exact: true }).first().click();
		await page.locator('[data-row-id="row-title"]').first().click();

		const reopenedTitleInput = configPanel.getByLabel("title", {
			exact: true,
		});
		await expect(
			getBuilderAssistToken(reopenedTitleInput, "item"),
		).toBeVisible();
		await expect
			.poll(() => readBuilderAssistRawValue(reopenedTitleInput))
			.toBe(`Total: {${ITEM_RESOURCE_ID}.price}`);
	});

	test("edits source, destination, and visible binding expressions", async ({
		page,
	}) => {
		await openBuilderAssistFlow(page);

		await page.getByText("Editable title", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);

		const sourceInput = configPanel.getByLabel("Row data source");
		await sourceInput.click();
		await sourceInput.press("ControlOrMeta+A");
		await sourceInput.pressSequentially("{it");
		await selectBuilderAssistOption(
			page.getByRole("listbox", { name: "Row data source" }),
			"item",
		);
		await page.keyboard.type("}");
		await expect
			.poll(() => readBuilderAssistRawValue(sourceInput))
			.toBe(`{${ITEM_RESOURCE_ID}}`);

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
			.poll(() => readBuilderAssistRawValue(visibleInput))
			.toBe("{$datum.price > 0");

		const destinationInput = configPanel.getByLabel("Row destination");
		await destinationInput.clear();
		await destinationInput.pressSequentially("{or");
		await selectBuilderAssistOption(
			page.getByRole("listbox", { name: "Row destination" }),
			"order",
		);
		await page.keyboard.type("}");
		await expect
			.poll(() => readBuilderAssistRawValue(destinationInput))
			.toBe(`{${ORDER_RESOURCE_ID}}`);

		await page.getByText("Open checkout", { exact: true }).first().click();
		await page.getByText("Editable title", { exact: true }).first().click();

		await expect
			.poll(() =>
				readBuilderAssistRawValue(
					configPanel.getByLabel("Row visibility condition"),
				),
			)
			.toBe("{$datum.price > 0");
		await expect(
			getBuilderAssistToken(
				configPanel.getByLabel("Row destination"),
				"order",
			),
		).toBeVisible();
	});

	test("configures action branches with PopoverSelect arguments and persists them", async ({
		page,
	}) => {
		await openBuilderAssistFlow(page);

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

		const namespaceArg = popup.getByLabel("false-0-arg-0");
		await expect(namespaceArg).toBeVisible();
		await popoverSelect(page, namespaceArg, "Test Service");

		const resourceArg = popup.getByLabel("false-0-arg-1");
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
			configPanel.getByText("create(Test Service, item, submit)", {
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
				readBuilderAssistRawValue(
					reopenedPopup.getByLabel("true-0-navigate-query"),
				),
			)
			.toBe("{items: [$datum.id]}");
	});

	test("keeps prose matching a resource id as plain text in content fields", async ({
		page,
	}) => {
		await openBuilderAssistFlow(page);

		await page
			.getByText("Search messages", { exact: true })
			.first()
			.click();
		const configPanel = getConfigPanel(page);

		const noResults = configPanel.getByLabel("no_results", { exact: true });
		await expect(getBuilderAssistToken(noResults, "message")).toHaveCount(
			0,
		);
		await expect(noResults).toHaveText("No messages found");
		await expect
			.poll(() => readBuilderAssistRawValue(noResults))
			.toBe("No messages found");

		const placeholder = configPanel.getByLabel("placeholder", {
			exact: true,
		});
		await expect(getBuilderAssistToken(placeholder, "message")).toHaveCount(
			0,
		);
		await expect(placeholder).toHaveText("Filter messages by type");
		await expect
			.poll(() => readBuilderAssistRawValue(placeholder))
			.toBe("Filter messages by type");
	});

	test("still chips resource ids in bindings and inside interpolations", async ({
		page,
	}) => {
		await openBuilderAssistFlow(page);

		await page
			.getByText("Search messages", { exact: true })
			.first()
			.click();
		const configPanel = getConfigPanel(page);

		const sourceInput = configPanel.getByLabel("Row data source");
		await expect(
			getBuilderAssistToken(sourceInput, "message"),
		).toHaveAttribute("data-value", MESSAGES_RESOURCE_ID);

		await page.getByText("Mixed row", { exact: true }).first().click();
		const subtitle = configPanel.getByLabel("subtitle", { exact: true });
		await expect(getBuilderAssistToken(subtitle, "message")).toHaveCount(1);
		await expect(subtitle).toHaveText("None for {message}");
		await expect
			.poll(() => readBuilderAssistRawValue(subtitle))
			.toBe(`None for {${MESSAGES_RESOURCE_ID}}`);
	});

	test("shows resource ids as named chips in update() argument fields", async ({
		page,
	}) => {
		await openBuilderAssistFlow(page, [
			{
				condition: "",
				false: "",
				true: {
					fn: "update",
					service: TEST_SERVICE_ID,
					resource: ITEM_RESOURCE_ID,
					mode: "store",
					filter: {
						fk: `${ITEM_RESOURCE_ID}.id`,
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
		await expect(getBuilderAssistToken(filterField, "item")).toBeVisible();
		await expect(filterField).not.toContainText(ITEM_RESOURCE_ID);
		await expect
			.poll(() => readBuilderAssistRawValue(filterField))
			.toBe(`{fk: ${ITEM_RESOURCE_ID}.id, closedAt: null}`);

		const changesField = popup.getByLabel("true-0-update-changes");
		await expect
			.poll(() => readBuilderAssistRawValue(changesField))
			.toBe("{closedAt: now()}");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText(
				"update(Test Service, item, {fk: item.id, closedAt: null}, {closedAt: now()})",
				{ exact: true },
			),
		).toBeVisible();
	});
});
