import { expect, test } from "@playwright/test";
import type { UI_Flow as ServerFlow } from "evy-types";
import type { Page } from "@playwright/test";

import {
	createNewFlowThroughPicker,
	openAppWithFullFlows,
	openFlowPicker,
	selectFlowByLabel,
	SELECTORS,
} from "./utils";

test.describe("Flow Selector", () => {
	const threeFlows: ServerFlow[] = [
		{
			id: "flow-1",
			name: "First Flow",
			pages: [
				{
					id: "page-1-1",
					title: "Page 1 of Flow 1",
					rows: [
						{
							id: "row-1-1-1",
							type: "Info",
							view: {
								content: {
									title: "Flow 1 Info",
									subtitle: "This is from Flow 1",
								},
							},
							actions: [],
						},
					],
				},
			],
		},
		{
			id: "flow-2",
			name: "Second Flow",
			pages: [
				{
					id: "page-2-1",
					title: "Page 1 of Flow 2",
					rows: [
						{
							id: "row-2-1-1",
							type: "Info",
							view: {
								content: {
									title: "Flow 2 Info",
									subtitle: "This is from Flow 2",
								},
							},
							actions: [],
						},
					],
				},
				{
					id: "page-2-2",
					title: "Page 2 of Flow 2",
					rows: [],
				},
			],
		},
		{
			id: "flow-3",
			name: "Third Flow",
			pages: [
				{
					id: "page-3-1",
					title: "Page 1 of Flow 3",
					rows: [],
				},
			],
		},
	];

	const singleFlow: ServerFlow[] = [threeFlows[0]];

	async function openWithFlows(page: Page, flows: ServerFlow[]) {
		await openAppWithFullFlows(page, flows);
	}

	test("should display flow selector dropdown", async ({ page }) => {
		await openWithFlows(page, singleFlow);
		const flowSelector = page.locator(SELECTORS.flowSelector);
		await expect(flowSelector).toBeVisible();
	});

	test("should show first flow selected by default", async ({ page }) => {
		await openWithFlows(page, singleFlow);
		const flowSelector = page.locator(SELECTORS.flowSelector);
		await expect(flowSelector).toHaveAttribute("data-value", "flow-1");
	});

	test("should list all available flows in dropdown", async ({ page }) => {
		await openWithFlows(page, threeFlows);
		await openFlowPicker(page);

		const listbox = page.getByRole("listbox", { name: "Active flow" });
		const options = listbox.getByRole("option");
		await expect(options).toHaveCount(4);

		await expect(options.nth(0)).toHaveText("First Flow");
		await expect(options.nth(1)).toHaveText("Second Flow");
		await expect(options.nth(2)).toHaveText("Third Flow");
		await expect(options.nth(3)).toHaveText("Create new flow");
	});

	test("should create a new flow from the dropdown and select it", async ({
		page,
	}) => {
		await openWithFlows(page, singleFlow);
		await createNewFlowThroughPicker(page, "Brand New Flow");

		await expect(page.getByTestId("create-flow-dialog")).not.toBeVisible();

		const flowSelector = page.locator(SELECTORS.flowSelector);
		const newFlowId = await flowSelector.getAttribute("data-value");
		expect(newFlowId).toBeTruthy();
		expect(newFlowId).not.toBe("flow-1");
		await expect(flowSelector).toContainText("Brand New Flow");
	});

	test("should display content from first flow initially", async ({ page }) => {
		await openWithFlows(page, singleFlow);
		// Should show Flow 1's content
		await expect(page.getByText("Flow 1 Info", { exact: true })).toBeVisible();

		// Should not show Flow 2's content
		await expect(
			page.getByText("Flow 2 Info", { exact: true }),
		).not.toBeVisible();
	});

	test("should switch flows when selecting a different option", async ({
		page,
	}) => {
		await openWithFlows(page, threeFlows);

		// Initially on Flow 1
		await expect(page.getByText("Flow 1 Info", { exact: true })).toBeVisible();

		// Switch to Flow 2
		await selectFlowByLabel(page, "Second Flow");

		// Should now show Flow 2's content
		await expect(page.getByText("Flow 2 Info", { exact: true })).toBeVisible();

		// Should no longer show Flow 1's content
		await expect(
			page.getByText("Flow 1 Info", { exact: true }),
		).not.toBeVisible();
	});

	test("should update pages when switching flows", async ({ page }) => {
		await openWithFlows(page, threeFlows);
		const phoneContainers = page.locator(SELECTORS.phoneContainer);

		// Flow 1 has 1 page
		await expect(phoneContainers).toHaveCount(1);

		// Switch to Flow 2 which has 2 pages
		await selectFlowByLabel(page, "Second Flow");

		// Should now show 2 phone containers for Flow 2's pages
		await expect(phoneContainers).toHaveCount(2);

		// Switch to Flow 3 which has 1 page
		await selectFlowByLabel(page, "Third Flow");

		// Should now show 1 phone container
		await expect(phoneContainers).toHaveCount(1);
	});

	test("should preserve flow selection when interacting with the app", async ({
		page,
	}) => {
		await openWithFlows(page, threeFlows);
		const flowSelector = page.locator(SELECTORS.flowSelector);

		// Switch to Flow 2
		await selectFlowByLabel(page, "Second Flow");
		await expect(flowSelector).toHaveAttribute("data-value", "flow-2");

		// Interact with the app (click on a row)
		const infoRow = page.getByText("Flow 2 Info", { exact: true });
		await infoRow.click();

		// Flow selection should still be Flow 2
		await expect(flowSelector).toHaveAttribute("data-value", "flow-2");
	});

	test("should switch back to first flow after selecting another", async ({
		page,
	}) => {
		await openWithFlows(page, threeFlows);
		const flowSelector = page.locator(SELECTORS.flowSelector);

		// Switch to Flow 3
		await selectFlowByLabel(page, "Third Flow");
		await expect(flowSelector).toHaveAttribute("data-value", "flow-3");

		// Switch back to Flow 1
		await selectFlowByLabel(page, "First Flow");
		await expect(flowSelector).toHaveAttribute("data-value", "flow-1");

		// Should show Flow 1's content again
		await expect(page.getByText("Flow 1 Info", { exact: true })).toBeVisible();
	});
});
