import { expect, test } from "@playwright/test";
import {
	SELECTORS,
	getDropIndicator,
	getFirstPage,
	getPageContent,
	getPageRow,
	getSidebarRow,
	initTestFlows,
} from "./utils";

test.describe("Drag Hover Indicator Behavior", () => {
	test("should show drop indicator when hovering over a row on a page", async ({
		page,
	}) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

		const sidebarRow = await getSidebarRow(page, "Info row title");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const targetSidebarRow = await getSidebarRow(page, "Text row title");
		await targetSidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const pageRow = getPageRow(page, "Text row title");

		const sidebarBox = await sidebarRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (sidebarBox && rowBox) {
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
		}
	});

	test("should show drop indicator inside a container when hovering over container children", async ({
		page,
	}) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

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

		const childSidebarRow = await getSidebarRow(page, "Info row title");
		const containerRow = getPageRow(page, "List container row title");

		await childSidebarRow.dragTo(containerRow);

		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		const dragRow = await getSidebarRow(page, "Text row title");
		const childRow = getPageRow(page, "Info row title");

		const dragBox = await dragRow.boundingBox();
		const childBox = await childRow.boundingBox();

		if (dragBox && childBox) {
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
		}
	});

	test("should show only one drop indicator at a time", async ({ page }) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const rowTypes = ["Info row title", "Text row title", "Button row text"];
		for (const rowText of rowTypes) {
			const sidebarRow = await getSidebarRow(page, rowText);
			await sidebarRow.dragTo(pageContent);
			await expect(firstPage.getByText(rowText, { exact: true })).toBeVisible();
		}

		const pageRows = pageContent.locator(SELECTORS.rowContainer);
		const dragRow = await getSidebarRow(page, "Calendar row title");

		const firstPageRow = pageRows.first();
		const secondPageRow = pageRows.nth(1);

		const dragBox = await dragRow.boundingBox();
		const firstRowBox = await firstPageRow.boundingBox();
		const secondRowBox = await secondPageRow.boundingBox();

		if (dragBox && firstRowBox && secondRowBox) {
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
		}
	});

	test("should show indicator for innermost row when hovering over nested containers", async ({
		page,
	}) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

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

		const childRow = await getSidebarRow(page, "Info row title");
		await childRow.dragTo(innerContainer);

		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		const dragRow = await getSidebarRow(page, "Text row title");
		const childRowElement = getPageRow(page, "Info row title");

		const dragBox = await dragRow.boundingBox();
		const childBox = await childRowElement.boundingBox();

		if (dragBox && childBox) {
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
		}
	});

	test("should clear indicator when drag ends", async ({ page }) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

		const pageContent = getPageContent(page);

		const targetSidebarRow = await getSidebarRow(page, "Text row title");
		await targetSidebarRow.dragTo(pageContent);

		const pageRow = getPageRow(page, "Text row title");
		const dragRow = await getSidebarRow(page, "Info row title");

		const dragBox = await dragRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (dragBox && rowBox) {
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
		}
	});

	test("should switch indicator when moving between rows", async ({ page }) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const rowTypes = ["Info row title", "Text row title"];
		for (const rowText of rowTypes) {
			const sidebarRow = await getSidebarRow(page, rowText);
			await sidebarRow.dragTo(pageContent);
			await expect(firstPage.getByText(rowText, { exact: true })).toBeVisible();
		}

		const pageRows = pageContent.locator(SELECTORS.rowContainer);
		const dragRow = await getSidebarRow(page, "Button row text");

		const firstPageRow = pageRows.filter({ hasText: "Info row title" }).first();
		const secondPageRow = pageRows
			.filter({ hasText: "Text row title" })
			.first();

		const dragBox = await dragRow.boundingBox();
		const firstRowBox = await firstPageRow.boundingBox();
		const secondRowBox = await secondPageRow.boundingBox();

		if (dragBox && firstRowBox && secondRowBox) {
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
		}
	});

	test("should show indicator at top edge when hovering near top of row", async ({
		page,
	}) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

		const pageContent = getPageContent(page);

		const targetSidebarRow = await getSidebarRow(page, "Text row title");
		await targetSidebarRow.dragTo(pageContent);

		const pageRow = getPageRow(page, "Text row title");
		const dragRow = await getSidebarRow(page, "Info row title");

		const dragBox = await dragRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (dragBox && rowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2,
			);
			await page.mouse.down();
			await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + 10);

			const topIndicator = page.locator(SELECTORS.topIndicator);
			await expect(topIndicator.first()).toBeVisible();

			await page.mouse.up();
		}
	});

	test("should show indicator at bottom edge when hovering near bottom of row", async ({
		page,
	}) => {
		await initTestFlows(page, [{ id: "step_1", title: "Page 1", rows: [] }]);
		await page.goto("/");

		const pageContent = getPageContent(page);

		const targetSidebarRow = await getSidebarRow(page, "Text row title");
		await targetSidebarRow.dragTo(pageContent);

		const pageRow = getPageRow(page, "Text row title");
		const dragRow = await getSidebarRow(page, "Info row title");

		const dragBox = await dragRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (dragBox && rowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2,
			);
			await page.mouse.down();
			await page.mouse.move(
				rowBox.x + rowBox.width / 2,
				rowBox.y + rowBox.height - 10,
			);

			const bottomIndicator = page.locator(SELECTORS.bottomIndicator);
			await expect(bottomIndicator.first()).toBeVisible();

			await page.mouse.up();
		}
	});
});
