import { expect, test } from "@playwright/test";
import {
	getFirstPage,
	getPageContent,
	initTestFlows,
	getSidebarRow,
} from "./utils";

test.describe("Row Selection", () => {
	test("should select a row when clicked", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "First Info Row",
								text: "First row text content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");

		// Find and click on the first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await expect(firstInfoRow).toBeVisible();
		await firstInfoRow.click();

		// The configuration panel should show the row's configuration
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Verify configuration inputs are visible for the selected row
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toBeVisible();
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"First Info Row",
		);
	});

	test("should update configuration panel when different row is selected", async ({
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
								title: "First Info Row",
								text: "First row text content",
							},
						},
						actions: [],
					},
					{
						type: "Info",
						view: {
							content: {
								title: "Second Info Row",
								text: "Second row text content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Click on first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await firstInfoRow.click();

		// Verify first row's title is shown
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"First Info Row",
		);

		// Click on second Info row
		const secondInfoRow = page
			.getByText("Second Info Row", { exact: true })
			.first();
		await secondInfoRow.click();

		// Verify second row's title is now shown
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"Second Info Row",
		);
	});

	test("should show only one row selected at a time", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "First Info Row",
								text: "First row text content",
							},
						},
						actions: [],
					},
					{
						type: "Text",
						view: {
							content: {
								title: "Text Row",
								text: "Text row content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Click on first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await firstInfoRow.click();

		// Click on Text row
		const textRow = page.getByText("Text Row", { exact: true }).first();
		await textRow.click();

		// Configuration should show Text row config, not Info row
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"Text Row",
		);
	});

	test("should show configuration for dragged row after drop", async ({
		page,
	}) => {
		await initTestFlows(page, [{ id: "step_1", title: "Test Page", rows: [] }]);
		await page.goto("/");

		const sidebarRow = await getSidebarRow(page, "Input row title");
		const pageContent = getPageContent(page);
		const firstPage = getFirstPage(page);

		await sidebarRow.dragTo(pageContent);

		// The dropped row should be visible
		await expect(
			firstPage.getByText("Input row title", { exact: true }),
		).toBeVisible();

		// Click on the newly added row
		const inputRow = firstPage
			.getByText("Input row title", { exact: true })
			.first();
		await inputRow.click();

		// Configuration panel should show input row configuration
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toBeVisible();
	});

	test("should update row content when editing configuration", async ({
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
								title: "First Info Row",
								text: "First row text content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");

		// Click on first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await firstInfoRow.click();

		// Update the title in the configuration panel
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		const titleInput = configPanel.getByLabel("title", { exact: true });

		await titleInput.clear();
		await titleInput.fill("Updated Title");

		// The row should now display the updated title (scope to canvas, not navbar breadcrumb)
		await expect(
			getFirstPage(page).getByText("Updated Title", { exact: true }),
		).toBeVisible();
		await expect(
			getFirstPage(page).getByText("First Info Row", { exact: true }),
		).not.toBeVisible();
	});

	test("should maintain selection when switching configuration values", async ({
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
								title: "First Info Row",
								text: "First row text content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		await page.goto("/");

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Click on first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await firstInfoRow.click();

		// Edit the text field
		const textInput = configPanel.getByLabel("text");
		await textInput.clear();
		await textInput.fill("New text content");

		// Title should still show the same row's title
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"First Info Row",
		);

		// The updated text should be visible
		await expect(textInput).toHaveValue("New text content");
	});
});

test.describe("Row Selection with Containers", () => {
	test("should select container row when clicked", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "ListContainer",
						actions: [],
						view: {
							content: {
								title: "Container Row",
								children: [
									{
										type: "Info",
										view: {
											content: {
												title: "Child Info Row",
												text: "Child row text",
											},
										},
										actions: [],
									},
								],
							},
						},
					},
				],
			},
		]);
		await page.goto("/");

		const containerRow = page
			.getByText("Container Row", { exact: true })
			.first();
		await containerRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		await expect(
			configPanel.getByLabel("title", { exact: true }).first(),
		).toHaveValue("Container Row");
	});

	test("should select child row inside container when clicked", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "ListContainer",
						actions: [],
						view: {
							content: {
								title: "Container Row",
								children: [
									{
										type: "Info",
										view: {
											content: {
												title: "Child Info Row",
												text: "Child row text",
											},
										},
										actions: [],
									},
								],
							},
						},
					},
				],
			},
		]);
		await page.goto("/");

		const childRow = page.getByText("Child Info Row", { exact: true }).first();
		await childRow.click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		await configPanel.getByRole("button", { name: /^Info$/ }).click();
		await expect(
			configPanel.getByLabel("title", { exact: true }).first(),
		).toHaveValue("Child Info Row");
	});

	test("should switch selection between container and child", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "ListContainer",
						actions: [],
						view: {
							content: {
								title: "Container Row",
								children: [
									{
										type: "Info",
										view: {
											content: {
												title: "Child Info Row",
												text: "Child row text",
											},
										},
										actions: [],
									},
								],
							},
						},
					},
				],
			},
		]);
		await page.goto("/");

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Select child first
		const childRow = page.getByText("Child Info Row", { exact: true }).first();
		await childRow.click();
		await configPanel.getByRole("button", { name: /^Info$/ }).click();
		await expect(
			configPanel.getByLabel("title", { exact: true }).first(),
		).toHaveValue("Child Info Row");

		await page
			.getByRole("button", { name: "Configure row: Container Row" })
			.click();
		await expect(
			configPanel.getByLabel("title", { exact: true }).first(),
		).toHaveValue("Container Row");
	});
});
