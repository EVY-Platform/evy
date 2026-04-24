import { expect, test } from "@playwright/test";
import {
	getConfigPanel,
	getFirstPage,
	getPageContent,
	getSidebarRow,
	openAppWithTestFlows,
} from "./utils";

test.describe("Row Selection", () => {
	test("should select a row when clicked", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "First Info Row",
								subtitle: "First row subtitle content",
							},
						},
						actions: [],
					},
				],
			},
		]); // Find and click on the first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await expect(firstInfoRow).toBeVisible();
		await firstInfoRow.click();

		const configPanel = getConfigPanel(page);

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
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "First Info Row",
								subtitle: "First row subtitle content",
							},
						},
						actions: [],
					},
					{
						type: "Info",
						view: {
							content: {
								title: "Second Info Row",
								subtitle: "Second row subtitle content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		const configPanel = getConfigPanel(page);

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
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "First Info Row",
								subtitle: "First row subtitle content",
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
		const configPanel = getConfigPanel(page);

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
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Test Page", rows: [] },
		]);
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
		const configPanel = getConfigPanel(page);
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toBeVisible();
	});

	test("should update row content when editing configuration", async ({
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
								title: "First Info Row",
								subtitle: "First row subtitle content",
							},
						},
						actions: [],
					},
				],
			},
		]); // Click on first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await firstInfoRow.click();

		// Update the title in the configuration panel
		const configPanel = getConfigPanel(page);
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
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Test Page",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "First Info Row",
								subtitle: "First row subtitle content",
							},
						},
						actions: [],
					},
				],
			},
		]);
		const configPanel = getConfigPanel(page);

		// Click on first Info row
		const firstInfoRow = page
			.getByText("First Info Row", { exact: true })
			.first();
		await firstInfoRow.click();

		// Edit the subtitle field
		const subtitleInput = configPanel.getByLabel("subtitle");
		await subtitleInput.clear();
		await subtitleInput.fill("New subtitle content");

		// Title should still show the same row's title
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"First Info Row",
		);

		// The updated subtitle should be visible
		await expect(subtitleInput).toHaveValue("New subtitle content");
	});
});

test.describe("Row Selection with Containers", () => {
	test("should select container row when clicked", async ({ page }) => {
		await openAppWithTestFlows(page, [
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
		const containerRow = page
			.getByText("Container Row", { exact: true })
			.first();
		await containerRow.click();

		const configPanel = getConfigPanel(page);
		await expect(
			configPanel.getByLabel("title", { exact: true }).first(),
		).toHaveValue("Container Row");
	});

	test("should select child row inside container when clicked", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
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
		const childRow = page.getByText("Child Info Row", { exact: true }).first();
		await childRow.click();

		const configPanel = getConfigPanel(page);
		await configPanel.getByRole("button", { name: /^Info$/ }).click();
		await expect(
			configPanel.getByLabel("title", { exact: true }).first(),
		).toHaveValue("Child Info Row");
	});

	test("should switch selection between container and child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
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
		const configPanel = getConfigPanel(page);

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
