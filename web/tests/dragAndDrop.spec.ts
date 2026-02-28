import { expect, test } from "@playwright/test";
import {
	SELECTORS,
	getFirstPage,
	getPageContent,
	getPageRow,
	getRowsPanel,
	getSidebarRow,
	initTestFlows,
} from "./utils";

test.describe("Drag & Drop UX", () => {
	test("should drag a row from the left sidebar onto a page", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const sidebarRow = getSidebarRow(page, "Info row title");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await sidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		const newRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();
		expect(newRowCount).toBe(initialRowCount + 1);
	});

	test("should drag a row from one page to another page", async ({ page }) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const sidebarRow = getSidebarRow(page, "Text row title");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);
		await sidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const pageRow = getPageRow(page, "Text row title");
		const secondPage = page.locator(SELECTORS.phoneContainer).nth(1);
		const secondPageContent = getPageContent(page, 1);

		const initialSecondPageRowCount = await secondPageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await pageRow.dragTo(secondPageContent);

		await expect(
			secondPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).not.toBeVisible();

		const newSecondPageRowCount = await secondPageContent
			.locator(SELECTORS.rowContainer)
			.count();
		expect(newSecondPageRowCount).toBe(initialSecondPageRowCount + 1);
	});

	test("should remove a row from a page by dragging it to the left sidebar", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const rowsPanel = getRowsPanel(page);
		const sidebarRow = getSidebarRow(page, "Button row text");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);
		await sidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Button row text", { exact: true }),
		).toBeVisible();

		const pageRow = getPageRow(page, "Button row text");
		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await pageRow.dragTo(rowsPanel);

		await expect(
			firstPage.getByText("Button row text", { exact: true }),
		).not.toBeVisible();

		const newRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();
		expect(newRowCount).toBe(initialRowCount - 1);
	});

	test("should drag a row from position 1 to 2 on a page", async ({ page }) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const firstSidebarRow = getSidebarRow(page, "Info row title");
		const secondSidebarRow = getSidebarRow(page, "Text row title");

		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await firstSidebarRow.dragTo(pageContent);
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 1,
		);
		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		await secondSidebarRow.dragTo(pageContent);
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 2,
		);
		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const pageRows = pageContent.locator(SELECTORS.draggableRow);
		await expect(pageRows.first()).toBeVisible();
		await expect(pageRows.nth(1)).toBeVisible();

		const firstRow = pageRows.first();
		const secondRow = pageRows.nth(1);
		const secondRowBox = await secondRow.boundingBox();

		if (secondRowBox) {
			await firstRow.dragTo(secondRow, {
				targetPosition: {
					x: secondRowBox.width / 2,
					y: secondRowBox.height - 5,
				},
			});
		}

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		const allRows = await pageContent.locator(SELECTORS.draggableRow).all();
		let textRowPosition = -1;
		let infoRowPosition = -1;

		for (let i = 0; i < allRows.length; i++) {
			const rowText = await allRows[i].textContent().catch(() => "");
			if (rowText?.includes("Text row title") && textRowPosition === -1) {
				textRowPosition = i;
			}
			if (rowText?.includes("Info row title") && infoRowPosition === -1) {
				infoRowPosition = i;
			}
		}

		expect(textRowPosition).not.toBe(-1);
		expect(infoRowPosition).not.toBe(-1);
		expect(infoRowPosition).toBeGreaterThan(textRowPosition);
	});

	test("should drag a row from position 2 to 1 on a page", async ({ page }) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const firstSidebarRow = getSidebarRow(page, "Info row title");
		const secondSidebarRow = getSidebarRow(page, "Text row title");

		const initialRowCount = await pageContent
			.locator(SELECTORS.rowContainer)
			.count();

		await firstSidebarRow.dragTo(pageContent);
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 1,
		);
		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		await secondSidebarRow.dragTo(pageContent);
		await expect(pageContent.locator(SELECTORS.rowContainer)).toHaveCount(
			initialRowCount + 2,
		);
		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();

		const pageRows = pageContent.locator(SELECTORS.draggableRow);
		await expect(pageRows.first()).toBeVisible();
		await expect(pageRows.nth(1)).toBeVisible();

		const firstRow = pageRows.first();
		const secondRow = pageRows.nth(1);
		const firstRowBox = await firstRow.boundingBox();

		if (firstRowBox) {
			await secondRow.dragTo(firstRow, {
				targetPosition: { x: firstRowBox.width / 2, y: 5 },
			});
		}

		await expect(
			firstPage.getByText("Text row title", { exact: true }),
		).toBeVisible();
		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		const allRows = await pageContent.locator(SELECTORS.draggableRow).all();
		let textRowPosition = -1;
		let infoRowPosition = -1;

		for (let i = 0; i < allRows.length; i++) {
			const rowText = await allRows[i].textContent().catch(() => "");
			if (rowText?.includes("Text row title") && textRowPosition === -1) {
				textRowPosition = i;
			}
			if (rowText?.includes("Info row title") && infoRowPosition === -1) {
				infoRowPosition = i;
			}
		}

		expect(textRowPosition).not.toBe(-1);
		expect(infoRowPosition).not.toBe(-1);
		expect(infoRowPosition).toBeGreaterThan(textRowPosition);
	});

	test("should drag from the left sidebar onto a container on a page", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const containerSidebarRow = getSidebarRow(page, "List container row title");
		await containerSidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("List container row title", { exact: true }),
		).toBeVisible();

		const containerRow = getPageRow(page, "List container row title");
		const sidebarRow = getSidebarRow(page, "Info row title");

		await sidebarRow.dragTo(containerRow);

		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();
	});

	test("should remove a row from a container on a page by dragging it to the left sidebar", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const rowsPanel = getRowsPanel(page);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const containerSidebarRow = getSidebarRow(page, "List container row title");
		await containerSidebarRow.dragTo(pageContent);

		const containerRow = getPageRow(page, "List container row title");

		await expect(
			firstPage.getByText("List container row title", { exact: true }),
		).toBeVisible();

		const sidebarRow = getSidebarRow(page, "Info row title");
		await sidebarRow.dragTo(containerRow);

		await expect(
			firstPage.getByText("Info row title", { exact: true }),
		).toBeVisible();

		const childRow = firstPage
			.getByText("Info row title", { exact: true })
			.first();
		await expect(childRow).toBeVisible();

		await childRow.locator("..").locator("..").dragTo(rowsPanel);

		await expect(
			containerRow.getByText("Info row title", { exact: true }),
		).not.toBeVisible();
	});

	test("should drag and drop every single row type into a page", async ({
		page,
	}) => {
		await initTestFlows(page, [
			{ id: "step_1", title: "Page 1", rows: [] },
			{ id: "step_2", title: "Page 2", rows: [] },
		]);
		await page.goto("/");

		const rowsPanel = getRowsPanel(page);
		const firstPage = getFirstPage(page);
		const pageContent = getPageContent(page);

		const allRowTypes = [
			"Info row title",
			"Text row title",
			"Input list row title",
			"Button row text",
			"Text action row title",
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
			"Sheet container row title",
		];

		const initialRowCount = await pageContent
			.locator(SELECTORS.draggableRow)
			.count();

		for (const rowText of allRowTypes) {
			const sidebarRow = rowsPanel
				.getByText(rowText, { exact: true })
				.locator("..");
			await expect(
				sidebarRow.getByText(rowText, { exact: true }),
			).toBeVisible();
			await sidebarRow.dragTo(pageContent);
			await expect(firstPage.getByText(rowText, { exact: true })).toBeVisible();
		}

		const finalRowCount = await pageContent
			.locator(SELECTORS.draggableRow)
			.count();
		expect(finalRowCount).toBe(initialRowCount + allRowTypes.length);

		for (const rowText of allRowTypes) {
			await expect(firstPage.getByText(rowText, { exact: true })).toBeVisible();
		}
	});
});
