import { expect, type Page, test } from "@playwright/test";
import { openAppWithTestFlows } from "./flowFixtures";
import {
	SELECTORS,
	getConfigPanel,
	getFirstPage,
	getPageRow,
	getSidebarRow,
} from "./utils";

async function openTwoSegmentTabContainer(page: Page) {
	await openAppWithTestFlows(page, [
		{
			id: "step_1",
			title: "Page 1",
			rows: [
				{
					type: "SelectSegmentContainer" as const,
					view: {
						content: {
							title: "Tab Container",
							segments: ["Segment A", "Segment B"],
							children: [
								{
									type: "Text" as const,
									view: {
										content: {
											title: "First Segment Child",
											subtitle: "First content",
										},
									},
									actions: [],
								},
								{
									type: "Text" as const,
									view: {
										content: {
											title: "Second Segment Child",
											text: "Second content",
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
}

test.describe("Child Page Rendering", () => {
	test("should show blank child page when selecting a row without a child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "Text",
						view: {
							content: {
								title: "Root Text Row",
								subtitle: "Root subtitle",
							},
						},
						actions: [],
					},
				],
			},
		]);

		// Click on the Text row to select it
		const textRow = page.getByText("Root Text Row", { exact: true }).first();
		await textRow.click();

		// Should see the blank child page to the right
		const blankChildPage = page.getByTestId("blank-child-page");
		await expect(blankChildPage).toBeVisible();
		await expect(
			blankChildPage.getByText("Drop a row to show in the sheet on tap"),
		).toBeVisible();

		// Should NOT have a child page (no child row exists)
		await expect(page.getByTestId("child-page")).not.toBeVisible();

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
						type: "Text" as const,
						view: {
							content: {
								title: "Parent Row",
								subtitle: "Parent subtitle",
								child: {
									type: "Text" as const,
									view: {
										content: {
											title: "Child Row Title",
											text: "Child text content",
										},
									},
									actions: [],
								},
							},
						},
						actions: [],
					},
				],
			},
		]);

		// Click on the parent Text row to select it
		const parentRow = page.getByText("Parent Row", { exact: true }).first();
		await parentRow.click();

		// Should see child page
		const childPage = page.getByTestId("child-page");
		await expect(childPage).toBeVisible();
		await expect(
			childPage.getByRole("heading", {
				name: "Sheet overlay",
			}),
		).toBeVisible();
		await expect(
			childPage.getByText("Child Row Title", { exact: true }),
		).toBeVisible();

		// Should NOT show the blank child page until the user clicks into the
		// existing child row.
		await expect(page.getByTestId("blank-child-page")).not.toBeVisible();

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
						type: "Text" as const,
						view: {
							content: {
								title: "Parent Row",
								subtitle: "Parent subtitle",
								child: {
									type: "Text" as const,
									view: {
										content: {
											title: "First Child Row",
											text: "First child text",
											child: {
												type: "Text" as const,
												view: {
													content: {
														title: "Second Child Row",
														text: "Second child text",
														child: {
															type: "Text" as const,
															view: {
																content: {
																	title: "Third Child Row",
																	text: "Third child text",
																},
															},
															actions: [],
														},
													},
												},
												actions: [],
											},
										},
									},
									actions: [],
								},
							},
						},
						actions: [],
					},
				],
			},
		]);

		await page.getByText("Parent Row", { exact: true }).first().click();

		let childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(1);
		await expect(
			childPages.first().getByText("First Child Row", { exact: true }),
		).toBeVisible();

		await childPages
			.filter({ hasText: "First Child Row" })
			.getByText("First Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(2);
		await expect(
			childPages.nth(0).getByText("First Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(1).getByText("Second Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-child-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(3);

		await childPages
			.filter({ hasText: "Second Child Row" })
			.getByText("Second Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(3);
		await expect(
			childPages.nth(0).getByText("First Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(1).getByText("Second Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(2).getByText("Third Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-child-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(4);

		await childPages
			.filter({ hasText: "Third Child Row" })
			.getByText("Third Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(3);
		await expect(page.getByTestId("blank-child-page")).toBeVisible();
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
						type: "SelectSegmentContainer" as const,
						view: {
							content: {
								title: "Root Select Segment",
								segments: ["Children 0"],
								children: [
									{
										type: "ListContainer" as const,
										view: {
											content: {
												title: "Children 0 List Container",
												children: [
													{
														type: "Text" as const,
														view: {
															content: {
																title: "Children 0 Text Row",
																text: "Text row",
															},
														},
														actions: [],
													},
													{
														type: "Text" as const,
														view: {
															content: {
																title: "Children 1 Text Action",
																text: "Action text",
																action: "Change",
																child: {
																	type: "Search" as const,
																	view: {
																		content: {
																			title: "Search Child Row",
																			placeholder: "Search...",
																			value: "",
																			child: {
																				type: "Text" as const,
																				view: {
																					content: {
																						title: "Search Text Child",
																						subtitle: "Text child",
																					},
																				},
																				actions: [],
																			},
																		},
																	},
																	actions: [],
																},
															},
														},
														actions: [
															{ condition: "", true: "{show()}", false: "" },
														],
													},
												],
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

		await getPageRow(page, "Root Select Segment").click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByRole("button", { name: "ListContainer" }).click();
		await configPanel
			.getByRole("button", { name: "Text", exact: true })
			.nth(1)
			.click();

		let childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(1);
		await expect(
			childPages.nth(0).getByText("Search Child Row", { exact: true }),
		).toBeVisible();

		await configPanel.getByRole("button", { name: "Search" }).click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(2);
		await expect(
			childPages.nth(0).getByText("Search Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(1).getByText("Search Text Child", { exact: true }),
		).toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(3);
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
						type: "Text" as const,
						view: {
							content: {
								title: "Parent Row",
								subtitle: "Parent subtitle",
								child: {
									type: "Text" as const,
									view: {
										content: {
											title: "Child Text Row",
											text: "Child text",
										},
									},
									actions: [],
								},
							},
						},
						actions: [],
					},
				],
			},
		]);

		// Click on the parent row to select it
		const parentRow = page.getByText("Parent Row", { exact: true }).first();
		await parentRow.click();

		// Verify child page is visible with its row
		const childPage = page.getByTestId("child-page");
		await expect(childPage).toBeVisible();
		await expect(
			childPage.getByRole("heading", {
				name: "Sheet overlay",
			}),
		).toBeVisible();

		// Click the child row in the child page
		const childRow = childPage
			.getByText("Child Text Row", { exact: true })
			.first();
		await childRow.click();

		// Configuration panel should show the child row's config (Text row config)
		const configPanel = getConfigPanel(page);
		await expect(configPanel.getByLabel("title", { exact: true })).toHaveValue(
			"Child Text Row",
		);
	});

	test("dropping a row into an existing child page replaces view.content.child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "Text" as const,
						view: {
							content: {
								title: "Parent Row",
								subtitle: "Parent subtitle",
								child: {
									type: "Text" as const,
									view: {
										content: {
											title: "Existing Child Row",
											text: "Existing child text",
										},
									},
									actions: [],
								},
							},
						},
						actions: [],
					},
				],
			},
		]);

		const parentRow = page.getByText("Parent Row", { exact: true }).first();
		await parentRow.click();

		const childPage = page.getByTestId("child-page");
		await expect(childPage).toBeVisible();
		await expect(
			childPage.getByText("Existing Child Row", { exact: true }),
		).toBeVisible();

		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(childPage.locator(SELECTORS.pageContent));

		// After drop, the child page immediately shows the new row
		// with a new blank child page beside it, no re-click needed.
		await expect(
			childPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		await expect(
			childPage.getByText("Existing Child Row", { exact: true }),
		).not.toBeVisible();
		// A new blank child page appears for the row that was just dropped
		// (it has no child of its own).
		await expect(page.getByTestId("blank-child-page")).toBeVisible();
	});

	test("dropping a row into the blank child page creates view.content.child", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "Text",
						view: {
							content: {
								title: "Root Row",
								subtitle: "Subtitle",
							},
						},
						actions: [],
					},
				],
			},
		]);

		// Click on the root row to select it and show the blank child page
		const rootRow = page.getByText("Root Row", { exact: true }).first();
		await rootRow.click();

		// Drag a row from sidebar to the blank child page
		const sidebarRow = await getSidebarRow(page, "Text row title");
		const blankChildPage = page.getByTestId("blank-child-page");
		await expect(blankChildPage).toBeVisible();

		await sidebarRow.dragTo(blankChildPage.locator(SELECTORS.pageContent));

		// After drop, the child page is immediately visible, no re-click needed.
		const childPage = page.getByTestId("child-page");
		await expect(childPage).toBeVisible({ timeout: 10000 });
		await expect(
			childPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		// A new blank child page appears for the row that was just dropped
		// (it has no child of its own).
		await expect(page.getByTestId("blank-child-page")).toBeVisible();

		// Non-Search parent should have received a show() action.
		// Navigate back to the parent via breadcrumb to verify.
		const breadcrumb = page.getByLabel("Configure row: Root Row");
		await expect(breadcrumb).toBeVisible();
		await breadcrumb.click();

		const configPanel = getConfigPanel(page);
		await expect(configPanel.getByText("Action 1")).toBeVisible();
		await expect(configPanel.getByText("If true")).toBeVisible();
		await expect(configPanel.getByText("show")).toBeVisible();
	});

	test("Search row no longer renders child/template preview directly on the main page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "Search" as const,
						view: {
							content: {
								title: "Search Row Title",
								placeholder: "Search...",
								value: "",
							},
						},
						actions: [],
					},
				],
			},
		]);

		// Click to select the search row
		const searchRow = page
			.getByText("Search Row Title", { exact: true })
			.first();
		await expect(searchRow).toBeVisible();
		await searchRow.click();

		// The Search row should show its search input but NOT render preview results children.
		// Verify existing elements are still visible.
		const activePage = getFirstPage(page);
		await expect(
			activePage.getByText("Search Row Title", { exact: true }),
		).toBeVisible();

		await expect(page.getByTestId("blank-child-page")).toBeVisible();
		await expect(page.getByTestId("child-page")).not.toBeVisible();

		// Verify the Search row only shows its own content, not preview rows.
		// There should be no "Example tag" preview text on the main page.
		await expect(
			activePage.getByText("Example tag", { exact: true }),
		).not.toBeVisible();
	});

	test("clicking a SelectSegmentContainer child from the config panel shows that child on the main page", async ({
		page,
	}) => {
		await openTwoSegmentTabContainer(page);

		// Select the SelectSegmentContainer row on the page
		await getPageRow(page, "Tab Container").click();

		// Initially, the first segment child should be visible on the main page
		const activePage = getFirstPage(page);
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).toBeVisible();

		// Click the second child row in the configuration panel
		const configPanel = getConfigPanel(page);
		await configPanel
			.getByRole("button", { name: "Text", exact: true })
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
			getConfigPanel(page).getByText("SelectSegmentContainer Row"),
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
			getConfigPanel(page).getByText("SelectSegmentContainer Row"),
		).toBeVisible();

		// Click back to the first segment — should switch back without deactivating
		await activePage
			.getByRole("button", { name: "Segment A", exact: true })
			.click();
		await expect(
			activePage.getByText("First Segment Child", { exact: true }),
		).toBeVisible();
		await expect(
			getConfigPanel(page).getByText("SelectSegmentContainer Row"),
		).toBeVisible();
	});
});
