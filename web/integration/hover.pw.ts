import { expect, type Locator, test } from "@playwright/test";
import invariant from "tiny-invariant";
import { openAppWithTestFlows } from "./flowFixtures";
import {
	getConfigPanel,
	getDropIndicator,
	getFirstPage,
	getPageContent,
	getPageRow,
	getSidebarRow,
	SELECTORS,
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

test.describe("Drag Hover Indicator Behavior", () => {
	test("should show drop indicator when hovering over a row on a page", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const sidebarRow = await getSidebarRow(page, "Text row title");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		await dragTextRowWithTitle(page, pageContent, "Target Text Row");

		await expect(
			firstPage.getByText("Target Text Row", { exact: true }),
		).toBeVisible();

		const pageRow = getPageRow(page, "Target Text Row");

		await sidebarRow.scrollIntoViewIfNeeded();
		await pageRow.scrollIntoViewIfNeeded();
		const sidebarBox = await getRequiredBoundingBox(sidebarRow);
		const rowBox = await getRequiredBoundingBox(pageRow);

		await page.mouse.move(
			sidebarBox.x + sidebarBox.width / 2,
			sidebarBox.y + sidebarBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			rowBox.x + rowBox.width / 2,
			rowBox.y + rowBox.height / 2,
		);

		await expect(getDropIndicator(page)).toBeVisible();
		await page.mouse.up();
	});

	test("should show drop indicator inside a container when hovering over container children", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
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
		await dragTextRowWithTitle(page, containerRow, "Child Text Row");

		await expect(
			firstPage.getByText("Child Text Row", { exact: true }),
		).toBeVisible();

		const dragRow = await getSidebarRow(page, "Text row title");
		const childRow = getPageRow(page, "Child Text Row");

		await dragRow.scrollIntoViewIfNeeded();
		await childRow.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const childBox = await getRequiredBoundingBox(childRow);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			childBox.x + childBox.width / 2,
			childBox.y + childBox.height / 2,
		);

		await expect(getDropIndicator(page).first()).toBeVisible();
		await page.mouse.up();
	});

	test("should show only one drop indicator at a time", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const rowTypes = [
			"First Text Row",
			"Second Text Row",
			"Third Text Row",
		];
		for (const rowText of rowTypes) {
			await dragTextRowWithTitle(page, pageContent, rowText);
			await expect(
				firstPage.getByText(rowText, { exact: true }),
			).toBeVisible();
		}

		const pageRows = pageContent.locator(SELECTORS.rowContainer);
		const dragRow = await getSidebarRow(page, "Text row title");

		const firstPageRow = pageRows.first();
		const secondPageRow = pageRows.nth(1);

		await dragRow.scrollIntoViewIfNeeded();
		await firstPageRow.scrollIntoViewIfNeeded();
		await secondPageRow.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const firstRowBox = await getRequiredBoundingBox(firstPageRow);
		const secondRowBox = await getRequiredBoundingBox(secondPageRow);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();

		await page.mouse.move(
			firstRowBox.x + firstRowBox.width / 2,
			firstRowBox.y + firstRowBox.height / 2,
		);

		const indicators = getDropIndicator(page);
		expect(await indicators.count()).toBe(1);

		await page.mouse.move(
			secondRowBox.x + secondRowBox.width / 2,
			secondRowBox.y + secondRowBox.height / 2,
		);

		expect(await indicators.count()).toBe(1);
		await page.mouse.up();
	});

	test("should show indicator for innermost row when hovering over nested containers", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const outerContainerRow = await getSidebarRow(
			page,
			"List container row title",
		);
		await outerContainerRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("List container row title", { exact: true }),
		).toBeVisible();

		const outerContainer = getPageRow(page, "List container row title");

		const innerContainerRow = await getSidebarRow(
			page,
			"Column container row title",
		);
		await innerContainerRow.dragTo(outerContainer);

		const innerContainer = getPageRow(page, "Column container row title");

		await dragTextRowWithTitle(page, innerContainer, "Nested Text Row");

		await expect(
			firstPage.getByText("Nested Text Row", { exact: true }),
		).toBeVisible();

		const dragRow = await getSidebarRow(page, "Text row title");
		const childRowElement = getPageRow(page, "Nested Text Row");

		await dragRow.scrollIntoViewIfNeeded();
		await childRowElement.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const childBox = await getRequiredBoundingBox(childRowElement);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			childBox.x + childBox.width / 2,
			childBox.y + childBox.height / 2,
		);

		await expect(getDropIndicator(page).first()).toBeVisible();
		expect(await getDropIndicator(page).count()).toBe(1);

		await page.mouse.up();
	});

	test("should clear indicator when drag ends", async ({ page }) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const pageContent = getPageContent(page);

		await dragTextRowWithTitle(page, pageContent, "Target Text Row");

		const pageRow = getPageRow(page, "Target Text Row");
		const dragRow = await getSidebarRow(page, "Text row title");

		await dragRow.scrollIntoViewIfNeeded();
		await pageRow.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const rowBox = await getRequiredBoundingBox(pageRow);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			rowBox.x + rowBox.width / 2,
			rowBox.y + rowBox.height / 2,
		);

		await expect(getDropIndicator(page)).toBeVisible();
		await page.mouse.up();
		await expect(getDropIndicator(page)).not.toBeVisible();
	});

	test("should switch indicator when moving between rows", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const rowTypes = ["First Text Row", "Second Text Row"];
		for (const rowText of rowTypes) {
			await dragTextRowWithTitle(page, pageContent, rowText);
			await expect(
				firstPage.getByText(rowText, { exact: true }),
			).toBeVisible();
		}

		const pageRows = pageContent.locator(SELECTORS.rowContainer);
		const dragRow = await getSidebarRow(page, "Text row title");

		const firstPageRow = pageRows
			.filter({ hasText: "First Text Row" })
			.first();
		const secondPageRow = pageRows
			.filter({ hasText: "Second Text Row" })
			.first();

		await dragRow.scrollIntoViewIfNeeded();
		await firstPageRow.scrollIntoViewIfNeeded();
		await secondPageRow.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const firstRowBox = await getRequiredBoundingBox(firstPageRow);
		const secondRowBox = await getRequiredBoundingBox(secondPageRow);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();

		await page.mouse.move(
			firstRowBox.x + firstRowBox.width / 2,
			firstRowBox.y + firstRowBox.height / 2,
		);

		const indicator = getDropIndicator(page);
		await expect(indicator.first()).toBeVisible();

		await page.mouse.move(
			secondRowBox.x + secondRowBox.width / 2,
			secondRowBox.y + secondRowBox.height / 2,
		);

		await expect(indicator.first()).toBeVisible();
		expect(await indicator.count()).toBe(1);

		await page.mouse.up();
	});

	test("should show indicator at top edge when hovering near top of row", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const pageContent = getPageContent(page);

		await dragTextRowWithTitle(page, pageContent, "Target Text Row");

		const pageRow = getPageRow(page, "Target Text Row");
		const dragRow = await getSidebarRow(page, "Text row title");

		await dragRow.scrollIntoViewIfNeeded();
		await pageRow.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const rowBox = await getRequiredBoundingBox(pageRow);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + 10);

		const topIndicator = page.locator(SELECTORS.topIndicator);
		await expect(topIndicator.first()).toBeVisible();

		await page.mouse.up();
	});

	test("should show indicator at bottom edge when hovering near bottom of row", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
		]);
		const pageContent = getPageContent(page);

		await dragTextRowWithTitle(page, pageContent, "Target Text Row");

		const pageRow = getPageRow(page, "Target Text Row");
		const dragRow = await getSidebarRow(page, "Text row title");

		await dragRow.scrollIntoViewIfNeeded();
		await pageRow.scrollIntoViewIfNeeded();
		const dragBox = await getRequiredBoundingBox(dragRow);
		const rowBox = await getRequiredBoundingBox(pageRow);

		await page.mouse.move(
			dragBox.x + dragBox.width / 2,
			dragBox.y + dragBox.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			rowBox.x + rowBox.width / 2,
			rowBox.y + rowBox.height - 1,
		);

		const bottomIndicator = page.locator(SELECTORS.bottomIndicator);
		await expect(bottomIndicator.first()).toBeVisible();

		await page.mouse.up();
	});
});
