import { expect, type Locator, test } from "@playwright/test";
import invariant from "tiny-invariant";
import { openAppWithTestFlows } from "./flowFixtures";
import {
	expectDraggableSubrowOrder,
	getConfigPanel,
	getFirstPage,
	getPageContent,
	getPageRow,
	getRowsPanel,
	getSidebarRow,
	SELECTORS,
	setupTwoEmptyTestPages,
} from "./utils";

interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

async function getRequiredBoundingBox(locator: Locator): Promise<BoundingBox> {
	const box = await locator.boundingBox();
	invariant(box, "Expected locator to have a bounding box");
	return box;
}

async function dragTextRowWithTitle(
	page: Parameters<typeof getSidebarRow>[0],
	target: Awaited<ReturnType<typeof getPageContent>>,
	title: string,
) {
	const sidebarRow = await getSidebarRow(page, "Text row title");
	await sidebarRow.dragTo(target);

	const titleInput = getConfigPanel(page).getByLabel("title", {
		exact: true,
	});
	await titleInput.clear();
	await titleInput.fill(title);
}

test.describe("Drag & Drop UX", () => {
	test("should drag a row from the left sidebar onto a page", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const sidebarRow = await getSidebarRow(page, "Text row title");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await sidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const newRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();
		expect(newRowCount).toBe(initialRowCount + 1);
	});

	test("should drag a row from one page to another page", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);
		await dragTextRowWithTitle(page, pageContent, "Movable Text Row");

		await expect(
			firstPage.getByText("Movable Text Row", { exact: true }),
		).toBeVisible();

		// Clear selection so both pages are visible for cross-page drag
		const canvas = page.getByTestId("canvas-viewport");
		const canvasBox = await canvas.boundingBox();
		await canvas.click({
			position: { x: (canvasBox?.width ?? 400) / 2, y: 10 },
		});

		// Wait for both pages to be visible after clearing selection
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(2);

		const pageRow = getPageRow(page, "Movable Text Row");
		const secondPageContent = getPageContent(page, 1);

		await pageRow.dragTo(secondPageContent);

		// After move, row should be on the second page
		const secondPageFrame = page.locator(SELECTORS.phoneContainer).nth(1);
		await expect(
			secondPageFrame.getByText("Movable Text Row", { exact: true }),
		).toBeVisible();

		// First page should no longer have the row
		await expect(
			page
				.locator(SELECTORS.phoneContainer)
				.nth(0)
				.getByText("Movable Text Row", { exact: true }),
		).toHaveCount(0);
	});

	test("should drag a row from a child container to another page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						id: "column-1",
						type: "ColumnContainer" as const,
						view: {
							content: {
								title: "Column container row title",
								children: [
									{
										id: "column-child-1",
										type: "Text" as const,
										view: {
											content: {
												title: "Child Text",
												subtitle: "Child subtitle",
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
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		const firstPage = getFirstPage(page);
		const secondPage = page.locator(SELECTORS.phoneContainer).nth(1);
		const secondPageContent = getPageContent(page, 1);
		const childRow = getPageRow(page, "Child Text");

		await childRow.dragTo(secondPageContent);

		await expect(
			secondPage.getByText("Child Text", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("Child Text", { exact: true }),
		).not.toBeVisible();
	});

	test("should drag a row from a children container to another page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						id: "list-1",
						type: "ListContainer" as const,
						view: {
							content: {
								title: "List container row title",
								children: [
									{
										id: "list-child-1",
										type: "Text" as const,
										view: {
											content: {
												title: "Nested Text",
												subtitle: "Nested subtitle",
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
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		const firstPage = getFirstPage(page);
		const secondPage = page.locator(SELECTORS.phoneContainer).nth(1);
		const secondPageContent = getPageContent(page, 1);
		const childRow = getPageRow(page, "Nested Text");

		await childRow.dragTo(secondPageContent);

		await expect(
			secondPage.getByText("Nested Text", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("Nested Text", { exact: true }),
		).not.toBeVisible();
	});

	test("should remove a row from a page by dragging it to the left sidebar", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const rowsPanel = await getRowsPanel(page);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);
		await dragTextRowWithTitle(page, pageContent, "Removable Text Row");

		await expect(
			firstPage.getByText("Removable Text Row", { exact: true }),
		).toBeVisible();

		const pageRow = getPageRow(page, "Removable Text Row");
		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await pageRow.dragTo(rowsPanel);

		await expect(
			firstPage.getByText("Removable Text Row", { exact: true }),
		).not.toBeVisible();

		const newRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();
		expect(newRowCount).toBe(initialRowCount - 1);
	});

	test("should remove an empty column container by dragging it to the left sidebar", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const rowsPanel = await getRowsPanel(page);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const columnSidebarRow = await getSidebarRow(
			page,
			"Column container row title",
		);
		await columnSidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Column container row title", { exact: true }),
		).toBeVisible();

		const emptyColumnRow = pageContent
			.locator(SELECTORS.draggableRow)
			.filter({ hasText: "Column container row title" });
		await emptyColumnRow.dragTo(rowsPanel);

		await expect(
			firstPage.getByText("Column container row title", { exact: true }),
		).not.toBeVisible();
	});

	test("should drag a row from position 1 to 2 on a page", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await dragTextRowWithTitle(page, pageContent, "First Text Row");
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 1,
		);
		await expect(
			firstPage.getByText("First Text Row", { exact: true }),
		).toBeVisible();

		await dragTextRowWithTitle(page, pageContent, "Second Text Row");
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 2,
		);
		await expect(
			firstPage.getByText("Second Text Row", { exact: true }),
		).toBeVisible();

		const pageRows = pageContent.locator(SELECTORS.draggableRow);
		await expect(pageRows.first()).toBeVisible();
		await expect(pageRows.nth(1)).toBeVisible();

		const firstRow = pageRows.first();
		const secondRow = pageRows.nth(1);
		await secondRow.scrollIntoViewIfNeeded();
		const secondRowBox = await getRequiredBoundingBox(secondRow);
		await firstRow.dragTo(secondRow, {
			targetPosition: {
				x: secondRowBox.width / 2,
				y: secondRowBox.height - 5,
			},
		});

		await expect(
			firstPage.getByText("Second Text Row", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("First Text Row", { exact: true }),
		).toBeVisible();

		await expectDraggableSubrowOrder(
			pageContent,
			"Second Text Row",
			"First Text Row",
		);
	});

	test("should drag a row from position 2 to 1 on a page", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await dragTextRowWithTitle(page, pageContent, "First Text Row");
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 1,
		);
		await expect(
			firstPage.getByText("First Text Row", { exact: true }),
		).toBeVisible();

		await dragTextRowWithTitle(page, pageContent, "Second Text Row");
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 2,
		);
		await expect(
			firstPage.getByText("Second Text Row", { exact: true }),
		).toBeVisible();

		const pageRows = pageContent.locator(SELECTORS.draggableRow);
		await expect(pageRows.first()).toBeVisible();
		await expect(pageRows.nth(1)).toBeVisible();

		const firstRow = pageRows.first();
		const secondRow = pageRows.nth(1);
		await firstRow.scrollIntoViewIfNeeded();
		const firstRowBox = await getRequiredBoundingBox(firstRow);
		await secondRow.dragTo(firstRow, {
			targetPosition: { x: firstRowBox.width / 2, y: 5 },
		});

		await expect(
			firstPage.getByText("Second Text Row", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("First Text Row", { exact: true }),
		).toBeVisible();

		await expectDraggableSubrowOrder(
			pageContent,
			"Second Text Row",
			"First Text Row",
		);
	});

	test("should drag from the left sidebar onto a container on a page", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const containerSidebarRow = await getSidebarRow(
			page,
			"List container row title",
		);
		await containerSidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("List container row title", { exact: true }),
		).toBeVisible();

		const containerRow = getPageRow(page, "List container row title");
		const sidebarRow = await getSidebarRow(page, "Text row title");

		await sidebarRow.dragTo(containerRow);

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
	});

	test("should remove a row from a container on a page by dragging it to the left sidebar", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const rowsPanel = await getRowsPanel(page);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const containerSidebarRow = await getSidebarRow(
			page,
			"List container row title",
		);
		await containerSidebarRow.dragTo(pageContent);

		const containerRow = getPageRow(page, "List container row title");

		await expect(
			firstPage.getByText("List container row title", { exact: true }),
		).toBeVisible();

		const sidebarRow = await getSidebarRow(page, "Text row title");
		await sidebarRow.dragTo(containerRow);

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const childRow = firstPage
			.getByText("Text row title", { exact: true })
			.first();
		await expect(childRow).toBeVisible();

		await childRow.locator("..").locator("..").dragTo(rowsPanel);

		await expect(
			containerRow.getByText("Text row title", { exact: true }),
		).not.toBeVisible();
	});

	test("should show delete overlay on rows panel when dragging a page row", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const sidebarRow = await getSidebarRow(page, "Text row title");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		await sidebarRow.dragTo(pageContent);
		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const pageRow = getPageRow(page, "Text row title");
		await pageRow.scrollIntoViewIfNeeded();
		const rowBox = await getRequiredBoundingBox(pageRow);
		await page.mouse.move(
			rowBox.x + rowBox.width / 2,
			rowBox.y + rowBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			rowBox.x + rowBox.width / 2 + 10,
			rowBox.y + rowBox.height / 2 + 10,
		);

		const deleteOverlay = page.getByRole("button", { name: "Delete" });
		await expect(deleteOverlay).toBeVisible();

		await page.mouse.up();
	});

	test("should drag and drop every single row type into a page", async ({
		page,
	}) => {
		await setupTwoEmptyTestPages(page);

		const pageContent = getPageContent(page);

		const visibleRowTypes = [
			"Text row title",
			"Input list row title",
			"Calendar row title",
			"Dropdown row title",
			"Inline picker row title",
			"Input row title",
			"Search row title",
			"Select photo row title",
			"Text area row title",
			"Text select row title",
			"Column container row title",
			"List container row title",
			"Select segment container row title",
		];
		const buttonRowText = "Button row text";

		const initialRowCount = await pageContent
			.locator(SELECTORS.draggableRow)
			.count();

		for (const rowText of visibleRowTypes) {
			const sidebarRow = await getSidebarRow(page, rowText);
			await expect(sidebarRow).toBeVisible();
			await sidebarRow.dragTo(pageContent);
			const pageRow = getPageRow(page, rowText);
			await pageRow.scrollIntoViewIfNeeded();
			await expect(
				pageRow.getByText(rowText, { exact: true }),
			).toBeVisible();
		}

		const buttonSidebarRow = await getSidebarRow(page, buttonRowText);
		await expect(buttonSidebarRow).toBeVisible();
		await buttonSidebarRow.dragTo(pageContent);

		const finalRowCount = await pageContent
			.locator(SELECTORS.draggableRow)
			.count();
		expect(finalRowCount).toBe(
			initialRowCount + visibleRowTypes.length + 1,
		);

		for (const rowText of visibleRowTypes) {
			const pageRow = getPageRow(page, rowText);
			await pageRow.scrollIntoViewIfNeeded();
			await expect(
				pageRow.getByText(rowText, { exact: true }),
			).toBeVisible();
		}
	});
});
