import { expect, type Page, test } from "@playwright/test";
import { openAppWithTestFlows } from "./flowFixtures";
import {
	getConfigPanel,
	getFirstPage,
	getPageRow,
	getSidebarRow,
	SELECTORS,
} from "./utils";

async function openTwoSegmentTabContainer(page: Page) {
	await openAppWithTestFlows(page, [
		{
			id: "step_1",
			title: "Page 1",
			rows: [
				{
					type: "tab_container" as const,
					title: "Tab Container",
					segments: ["Segment A", "Segment B"],
					children: [
						{
							type: "text" as const,
							title: "First Segment Child",
							subtitle: "First content",
						},
						{
							type: "text" as const,
							title: "Second Segment Child",
							text: "Second content",
						},
					],
				},
			],
		},
	]);
}

test.describe("Sheet Page Rendering", () => {
	test("should show blank child page when selecting a row without a child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "text",
						title: "Root Text Row",
						subtitle: "Root subtitle",
					},
				],
			},
		]);

		// Click on the Text row to select it
		const textRow = page
			.getByText("Root Text Row", { exact: true })
			.first();
		await textRow.click();

		// Should see the blank child page to the right
		const blankSheetPage = page.getByTestId("blank-sheet-page");
		await expect(blankSheetPage).toBeVisible();
		await expect(
			blankSheetPage.getByText("Drop a row to show in the sheet on tap"),
		).toBeVisible();

		// Should NOT have a child page (no child row exists)
		await expect(page.getByTestId("sheet-page")).not.toBeVisible();

		// Should show exactly 2 phone frames: active page + blank child page
		const phoneFrames = page.locator(SELECTORS.phoneContainer);
		await expect(phoneFrames).toHaveCount(2);
	});

	test("should show child page AND blank child page when selecting a row with a child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "text" as const,
						title: "Parent Row",
						subtitle: "Parent subtitle",
						sheet: {
							type: "text" as const,
							title: "Sheet Row Title",
							text: "Sheet text content",
						},
					},
				],
			},
		]);

		// Click on the parent Text row to select it
		const parentRow = page.getByText("Parent Row", { exact: true }).first();
		await parentRow.click();

		// Should see child page
		const sheetPage = page.getByTestId("sheet-page");
		await expect(sheetPage).toBeVisible();
		await expect(
			sheetPage.getByRole("button", {
				name: "Sheet Row Title",
			}),
		).toBeVisible();
		await expect(
			sheetPage.getByText("Sheet Row Title", { exact: true }),
		).toHaveCount(1);

		// Should NOT show the blank child page until the user clicks into the
		// existing child row.
		await expect(page.getByTestId("blank-sheet-page")).not.toBeVisible();

		// Should show exactly 2 phone frames: active page + child page
		const phoneFrames = page.locator(SELECTORS.phoneContainer);
		await expect(phoneFrames).toHaveCount(2);
	});

	test("clicking nested child rows keeps existing child pages visible and adds the next one", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 2200, height: 1700 });
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "text" as const,
						title: "Parent Row",
						subtitle: "Parent subtitle",
						sheet: {
							type: "text" as const,
							title: "First Sheet Row",
							text: "First child text",
							sheet: {
								type: "text" as const,
								title: "Second Sheet Row",
								text: "Second child text",
								sheet: {
									type: "text" as const,
									title: "Third Sheet Row",
									text: "Third child text",
								},
							},
						},
					},
				],
			},
		]);

		await page.getByText("Parent Row", { exact: true }).first().click();

		let sheetPages = page.getByTestId("sheet-page");
		await expect(sheetPages).toHaveCount(1);
		await expect(
			sheetPages.first().getByText("First Sheet Row", { exact: true }),
		).toBeVisible();

		await sheetPages
			.filter({ hasText: "First Sheet Row" })
			.getByText("First Sheet Row", { exact: true })
			.click();

		sheetPages = page.getByTestId("sheet-page");
		await expect(sheetPages).toHaveCount(2);
		await expect(
			sheetPages.nth(0).getByText("First Sheet Row", { exact: true }),
		).toBeVisible();
		await expect(
			sheetPages.nth(1).getByText("Second Sheet Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-sheet-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(3);

		await sheetPages
			.filter({ hasText: "Second Sheet Row" })
			.getByText("Second Sheet Row", { exact: true })
			.click();

		sheetPages = page.getByTestId("sheet-page");
		await expect(sheetPages).toHaveCount(3);
		await expect(
			sheetPages.nth(0).getByText("First Sheet Row", { exact: true }),
		).toBeVisible();
		await expect(
			sheetPages.nth(1).getByText("Second Sheet Row", { exact: true }),
		).toBeVisible();
		await expect(
			sheetPages.nth(2).getByText("Third Sheet Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-sheet-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(4);

		await sheetPages
			.filter({ hasText: "Third Sheet Row" })
			.getByText("Third Sheet Row", { exact: true })
			.click();

		sheetPages = page.getByTestId("sheet-page");
		await expect(sheetPages).toHaveCount(3);
		await expect(page.getByTestId("blank-sheet-page")).toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(5);
	});

	test("keeps a row reached through children visible when opening its child page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "tab_container" as const,
						title: "Root Select Segment",
						segments: ["Children 0"],
						children: [
							{
								type: "vertical_container" as const,
								title: "Children 0 List Container",
								children: [
									{
										type: "text" as const,
										title: "Children 0 Text Row",
										text: "Text row",
									},
									{
										type: "text_action" as const,
										title: "Children 1 Text Action",
										action: "Change",
										sheet: {
											id: "search-sheet-row",
											type: "search" as const,
											title: "Search Sheet Row",
											placeholder: "Search...",
											value: "",
											child: {
												type: "text" as const,
												title: "Search Text Child",
												subtitle: "Text child",
											},
										},
										actions: {
											tap: [
												{
													condition: "",
													true: {
														fn: "show",
														row_id: "search-sheet-row",
													},
													false: "",
												},
											],
										},
									},
								],
							},
						],
					},
				],
			},
		]);

		await getPageRow(page, "Root Select Segment").click();
		const configPanel = getConfigPanel(page);
		await configPanel
			.getByRole("button", { name: /: vertical_container$/ })
			.click();
		await configPanel
			.getByRole("button", { name: /: text_action$/ })
			.click();

		let sheetPages = page.getByTestId("sheet-page");
		await expect(sheetPages).toHaveCount(1);
		await expect(
			sheetPages.nth(0).getByText("Search Sheet Row", { exact: true }),
		).toBeVisible();

		await configPanel.getByRole("button", { name: /: search$/ }).click();

		sheetPages = page.getByTestId("sheet-page");
		await expect(sheetPages).toHaveCount(1);
		await expect(
			sheetPages.nth(0).getByText("Search Sheet Row", { exact: true }),
		).toBeVisible();
		await expect(
			sheetPages.nth(0).getByTestId("search-child-sample"),
		).toBeVisible();
		await expect(
			sheetPages.nth(0).getByText("Search Text Child", { exact: true }),
		).toBeVisible();
		// Main page + Search sheet page + blank sheet drop target for Search
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(3);
		await expect(page.getByTestId("blank-sheet-page")).toBeVisible();
	});

	test("clicking the row in the child page selects that child row", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "text" as const,
						title: "Parent Row",
						subtitle: "Parent subtitle",
						sheet: {
							type: "text" as const,
							title: "Child Text Row",
							text: "Sheet text",
						},
					},
				],
			},
		]);

		// Click on the parent row to select it
		const parentRow = page.getByText("Parent Row", { exact: true }).first();
		await parentRow.click();

		// Verify child page is visible with its row
		const sheetPage = page.getByTestId("sheet-page");
		await expect(sheetPage).toBeVisible();
		await expect(
			sheetPage.getByRole("button", {
				name: "Child Text Row",
			}),
		).toBeVisible();

		// Click the sheet title to select the child row
		const childRow = sheetPage.getByRole("button", {
			name: "Child Text Row",
		});
		await childRow.click();

		// Configuration panel should show the child row's config (Text row config)
		const configPanel = getConfigPanel(page);
		await expect(
			configPanel.getByLabel("title", { exact: true }),
		).toHaveValue("Child Text Row");
	});

	test("dropping a row into an existing child page replaces child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "text" as const,
						title: "Parent Row",
						subtitle: "Parent subtitle",
						sheet: {
							type: "text" as const,
							title: "Existing Sheet Row",
							text: "Existing child text",
						},
					},
				],
			},
		]);

		const parentRow = page.getByText("Parent Row", { exact: true }).first();
		await parentRow.click();

		const sheetPage = page.getByTestId("sheet-page");
		await expect(sheetPage).toBeVisible();
		await expect(
			sheetPage.getByText("Existing Sheet Row", { exact: true }),
		).toBeVisible();

		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(sheetPage.locator(SELECTORS.pageContent));

		// After drop, the child page immediately shows the new row
		// with a new blank child page beside it, no re-click needed.
		await expect(
			sheetPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		await expect(
			sheetPage.getByText("Existing Sheet Row", { exact: true }),
		).not.toBeVisible();
		// A new blank child page appears for the row that was just dropped
		// (it has no child of its own).
		await expect(page.getByTestId("blank-sheet-page")).toBeVisible();
	});

	test("dropping a row into the blank child page creates child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "text",
						title: "Root Row",
						subtitle: "Subtitle",
					},
				],
			},
		]);

		// Click on the root row to select it and show the blank child page
		const rootRow = page.getByText("Root Row", { exact: true }).first();
		await rootRow.click();

		// Drag a row from sidebar to the blank child page
		const sidebarRow = await getSidebarRow(page, "Text row title");
		const blankSheetPage = page.getByTestId("blank-sheet-page");
		await expect(blankSheetPage).toBeVisible();

		await sidebarRow.dragTo(blankSheetPage.locator(SELECTORS.pageContent));

		// After drop, the child page is immediately visible, no re-click needed.
		const sheetPage = page.getByTestId("sheet-page");
		await expect(sheetPage).toBeVisible({ timeout: 10000 });
		await expect(
			sheetPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		// A new blank child page appears for the row that was just dropped
		// (it has no child of its own).
		await expect(page.getByTestId("blank-sheet-page")).toBeVisible();

		// Non-Search parent should have received a show(rowId) action.
		// Navigate back to the parent via breadcrumb to verify.
		const breadcrumb = page.getByLabel("Configure row: Root Row");
		await expect(breadcrumb).toBeVisible();
		await breadcrumb.click();

		const configPanel = getConfigPanel(page);
		await expect(configPanel.getByText("Action 1")).toBeVisible();
		await expect(configPanel.getByText("If true")).toBeVisible();
		await expect(configPanel.getByText("show")).toBeVisible();
	});

	test("Search with child renders one inline sample under the input", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "search" as const,
						title: "Search Row Title",
						placeholder: "Search...",
						value: "",
						child: {
							type: "text" as const,
							title: "Result Template",
							text: "Template body",
						},
					},
				],
			},
		]);

		const searchRow = page
			.getByText("Search Row Title", { exact: true })
			.first();
		await searchRow.click();

		const activePage = getFirstPage(page);
		await expect(
			activePage.getByTestId("search-child-sample"),
		).toBeVisible();
		await expect(
			activePage.getByText("Result Template", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("sheet-page")).not.toBeVisible();
	});

	test("Search without child shows inline drop target and optional blank sheet page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "search" as const,
						title: "Search Row Title",
						placeholder: "Search...",
						value: "",
					},
				],
			},
		]);

		const searchRow = page
			.getByText("Search Row Title", { exact: true })
			.first();
		await searchRow.click();

		const activePage = getFirstPage(page);
		await expect(
			activePage.getByTestId("search-child-drop-target"),
		).toBeVisible();
		await expect(page.getByTestId("blank-sheet-page")).toBeVisible();
		await expect(page.getByTestId("sheet-page")).not.toBeVisible();
	});

	test("clicking a TabContainer child from the config panel shows that child on the main page", async ({
		page,
	}) => {
		await openTwoSegmentTabContainer(page);

		// Select the TabContainer row on the page
		await getPageRow(page, "Tab Container").click();

		// Initially, the first segment child should be visible on the main page
		const activePage = getFirstPage(page);
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).toBeVisible();

		// Click the second child row in the configuration panel
		const configPanel = getConfigPanel(page);
		await configPanel
			.getByRole("button", { name: /: text$/ })
			.nth(1)
			.click();

		// Now the main phone page should show the second segment child
		await expect(
			activePage.getByText("Second Segment Child", { exact: true }),
		).toBeVisible();

		// The first segment child should no longer be visible on the main page
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).not.toBeVisible();
	});

	test("clicking segment buttons in the bar switches the visible child without toggling the container row inactive", async ({
		page,
	}) => {
		await openTwoSegmentTabContainer(page);

		// Select the container row first
		const activePage = getFirstPage(page);
		await getPageRow(page, "Tab Container").click();
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).toBeVisible();
		await expect(
			getConfigPanel(page).getByText("type: tab_container"),
		).toBeVisible();

		// Click the second segment in the bar — child should switch, row should stay active
		await activePage
			.getByRole("button", { name: "Segment B", exact: true })
			.click();
		await expect(
			activePage.getByText("Second Segment Child", { exact: true }),
		).toBeVisible();
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).not.toBeVisible();
		await expect(
			getConfigPanel(page).getByText("type: tab_container"),
		).toBeVisible();

		// Click back to the first segment — should switch back without deactivating
		await activePage
			.getByRole("button", { name: "Segment A", exact: true })
			.click();
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).toBeVisible();
		await expect(
			getConfigPanel(page).getByText("type: tab_container"),
		).toBeVisible();
	});
});
