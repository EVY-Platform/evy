import { expect, type Locator, test } from "@playwright/test";
import type { UI_Flow as ServerFlow } from "evy-types";
import { MARKETPLACE_SERVICE } from "evy-types/marketplaceResources";
import type { ServiceResource } from "../app/api/sync";
import { openAppWithFullFlows } from "./flowFixtures";
import { getConfigPanel, popoverSelect } from "./utils";

const ITEM_RESOURCE_ID = "res-item";
const ORDER_RESOURCE_ID = "res-order";

const SERVICE_RESOURCES: ServiceResource[] = [
	{
		id: ITEM_RESOURCE_ID,
		fkServiceId: MARKETPLACE_SERVICE,
		name: "item",
	},
	{
		id: ORDER_RESOURCE_ID,
		fkServiceId: MARKETPLACE_SERVICE,
		name: "order",
	},
];

const RESOURCE_ATTRIBUTE_METADATA = [
	{
		serviceId: MARKETPLACE_SERVICE,
		resourceId: ITEM_RESOURCE_ID,
		attributeNames: ["price", "title"],
	},
	{
		serviceId: MARKETPLACE_SERVICE,
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

function buildBuilderAssistFlow(
	buttonActions: { condition: string; false: string; true: string }[] = [
		{ condition: "", false: "", true: "" },
	],
): ServerFlow[] {
	return [
		{
			id: "flow-builder",
			name: "Builder Flow",
			submits: {
				service: MARKETPLACE_SERVICE,
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
	buttonActions?: { condition: string; false: string; true: string }[],
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
		await popoverSelect(page, namespaceArg, "Marketplace");

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
			configPanel.getByText("create(Marketplace, item, submit)", {
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

	test("shows resource ids as named chips in update() argument fields", async ({
		page,
	}) => {
		const updateBranch = `{update(${MARKETPLACE_SERVICE},${ITEM_RESOURCE_ID},{fk: ${ITEM_RESOURCE_ID}.id, archivedAt: null},{archivedAt: now()})}`;
		await openBuilderAssistFlow(page, [
			{ condition: "", false: "", true: updateBranch },
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
			.toBe(`{fk: ${ITEM_RESOURCE_ID}.id, archivedAt: null}`);

		const changesField = popup.getByLabel("true-0-update-changes");
		await expect
			.poll(() => readBuilderAssistRawValue(changesField))
			.toBe("{archivedAt: now()}");

		await popup.getByRole("button", { name: "Save" }).click();
		await expect(popup).not.toBeVisible();

		await expect(
			configPanel.getByText(
				"update(Marketplace, item, {fk: item.id, archivedAt: null}, {archivedAt: now()})",
				{ exact: true },
			),
		).toBeVisible();
	});
});
