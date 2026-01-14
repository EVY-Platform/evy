import { expect, test } from "@playwright/test";
import type { ServerFlow } from "../app/types";

test.describe("Flow Selector", () => {
	const testFlows: ServerFlow[] = [
		{
			id: "flow-1",
			name: "First Flow",
			type: "write",
			data: "",
			pages: [
				{
					id: "page-1-1",
					title: "Page 1 of Flow 1",
					rows: [
						{
							type: "Info",
							view: {
								content: {
									title: "Flow 1 Info",
									text: "This is from Flow 1",
								},
							},
						},
					],
				},
			],
		},
		{
			id: "flow-2",
			name: "Second Flow",
			type: "write",
			data: "",
			pages: [
				{
					id: "page-2-1",
					title: "Page 1 of Flow 2",
					rows: [
						{
							type: "Info",
							view: {
								content: {
									title: "Flow 2 Info",
									text: "This is from Flow 2",
								},
							},
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
			type: "write",
			data: "",
			pages: [
				{
					id: "page-3-1",
					title: "Page 1 of Flow 3",
					rows: [],
				},
			],
		},
	];

	test.beforeEach(async ({ page }) => {
		// Inject the full flows directly (not using initTestFlows which creates a wrapper)
		await page.addInitScript((flows: ServerFlow[]) => {
			(window as { __TEST_FLOWS__?: ServerFlow[] }).__TEST_FLOWS__ = flows;
		}, testFlows);
		await page.goto("/");
	});

	test("should display flow selector dropdown", async ({ page }) => {
		const flowSelector = page.locator("#flow-select");
		await expect(flowSelector).toBeVisible();
	});

	test("should show first flow selected by default", async ({ page }) => {
		const flowSelector = page.locator("#flow-select");
		await expect(flowSelector).toHaveValue("flow-1");
	});

	test("should list all available flows in dropdown", async ({ page }) => {
		const flowSelector = page.locator("#flow-select");

		// Check all flow options are present
		const options = flowSelector.locator("option");
		await expect(options).toHaveCount(3);

		await expect(options.nth(0)).toHaveText("First Flow");
		await expect(options.nth(1)).toHaveText("Second Flow");
		await expect(options.nth(2)).toHaveText("Third Flow");
	});

	test("should display content from first flow initially", async ({
		page,
	}) => {
		// Should show Flow 1's content
		await expect(
			page.getByText("Flow 1 Info", { exact: true }),
		).toBeVisible();

		// Should not show Flow 2's content
		await expect(
			page.getByText("Flow 2 Info", { exact: true }),
		).not.toBeVisible();
	});

	test("should switch flows when selecting a different option", async ({
		page,
	}) => {
		const flowSelector = page.locator("#flow-select");

		// Initially on Flow 1
		await expect(
			page.getByText("Flow 1 Info", { exact: true }),
		).toBeVisible();

		// Switch to Flow 2
		await flowSelector.selectOption("flow-2");

		// Should now show Flow 2's content
		await expect(
			page.getByText("Flow 2 Info", { exact: true }),
		).toBeVisible();

		// Should no longer show Flow 1's content
		await expect(
			page.getByText("Flow 1 Info", { exact: true }),
		).not.toBeVisible();
	});

	test("should update pages when switching flows", async ({ page }) => {
		const phoneContainers = page.locator('div[class*="evy-bg-phone"]');

		// Flow 1 has 1 page
		await expect(phoneContainers).toHaveCount(1);

		// Switch to Flow 2 which has 2 pages
		const flowSelector = page.locator("#flow-select");
		await flowSelector.selectOption("flow-2");

		// Should now show 2 phone containers for Flow 2's pages
		await expect(phoneContainers).toHaveCount(2);

		// Switch to Flow 3 which has 1 page
		await flowSelector.selectOption("flow-3");

		// Should now show 1 phone container
		await expect(phoneContainers).toHaveCount(1);
	});

	test("should preserve flow selection when interacting with the app", async ({
		page,
	}) => {
		const flowSelector = page.locator("#flow-select");

		// Switch to Flow 2
		await flowSelector.selectOption("flow-2");
		await expect(flowSelector).toHaveValue("flow-2");

		// Interact with the app (click on a row)
		const infoRow = page.getByText("Flow 2 Info", { exact: true });
		await infoRow.click();

		// Flow selection should still be Flow 2
		await expect(flowSelector).toHaveValue("flow-2");
	});

	test("should switch back to first flow after selecting another", async ({
		page,
	}) => {
		const flowSelector = page.locator("#flow-select");

		// Switch to Flow 3
		await flowSelector.selectOption("flow-3");
		await expect(flowSelector).toHaveValue("flow-3");

		// Switch back to Flow 1
		await flowSelector.selectOption("flow-1");
		await expect(flowSelector).toHaveValue("flow-1");

		// Should show Flow 1's content again
		await expect(
			page.getByText("Flow 1 Info", { exact: true }),
		).toBeVisible();
	});
});
