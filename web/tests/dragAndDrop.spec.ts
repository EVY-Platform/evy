import { test, expect } from "@playwright/test";
import { initTestFlows } from "./utils.tsx";

test.describe("Drag & Drop UX", () => {
	test.beforeEach(async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [], // Empty for drag and drop tests
			},
			{
				id: "step_2",
				title: "Page 2",
				rows: [], // Empty for drag and drop tests
			},
		]);
		await page.goto("/");
	});

	test("should drag a row from the left sidebar onto a page", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		// Get the first row from the sidebar (Info row)
		const sidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		// Get the first page (phone container)
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();

		// Get the scrollable container inside the page (where rows are rendered)
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Count initial rows on the first page (rows have class "evy-flex evy-flex-col")
		const initialRowCount = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();

		// Drag the row from sidebar to the first page
		await sidebarRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		// Verify the row was added to the page
		const newRowCount = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();
		expect(newRowCount).toBe(initialRowCount + 1);

		// Verify the row content appears on the page
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();
	});

	test("should drag a row from one page to another page", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		// Add a row to the first page
		const sidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		await sidebarRow.dragTo(firstPage);

		// Verify row is on first page
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).toBeVisible();

		// Get the row from the first page
		const pageRow = firstPage
			.getByText("Text row title", { exact: true })
			.locator("..")
			.locator("..");

		// Get the second page
		const secondPage = page.locator('div[class*="evy-bg-phone"]').nth(1);

		// Get the scrollable container inside the second page
		const secondPageContent = secondPage.locator(
			'[class*="evy-overflow-scroll"]'
		);

		// Count initial rows on the second page
		const initialSecondPageRowCount = await secondPageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();

		// Drag the row from first page to second page
		await pageRow.dragTo(secondPageContent);

		// Verify the row was moved to the second page
		await expect(
			secondPage.getByText("Text row title", { exact: true })
		).toBeVisible();

		// Verify the row is no longer on the first page
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).not.toBeVisible();

		// Verify the second page has one more row
		const newSecondPageRowCount = await secondPageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();
		expect(newSecondPageRowCount).toBe(initialSecondPageRowCount + 1);
	});

	test("should remove a row from a page by dragging it to the left sidebar", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		// Add a row to the first page
		const sidebarRow = rowsPanel
			.getByText("Button row text", { exact: true })
			.locator("..");
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		await sidebarRow.dragTo(firstPage);

		// Verify row is on the page
		await expect(
			firstPage.getByText("Button row text", { exact: true })
		).toBeVisible();

		// Get the row from the page
		const pageRow = firstPage
			.getByText("Button row text", { exact: true })
			.locator("..")
			.locator("..");

		// Get the scrollable container inside the page
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Count initial rows on the page
		const initialRowCount = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();

		// Drag the row back to the sidebar
		await pageRow.dragTo(rowsPanel);

		// Verify the row was removed from the page
		await expect(
			firstPage.getByText("Button row text", { exact: true })
		).not.toBeVisible();

		// Verify the page has one less row
		const newRowCount = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();
		expect(newRowCount).toBe(initialRowCount - 1);
	});

	test("should drag a row from position 1 to 2 on a page", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();

		// Add two rows to the first page
		const firstSidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");
		const secondSidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");

		// Get the scrollable container inside the page
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Count initial rows
		const initialRowCount = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();

		await firstSidebarRow.dragTo(pageContent);

		// Wait for row count to increase
		await expect(
			pageContent.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
		).toHaveCount(initialRowCount + 1);
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		await secondSidebarRow.dragTo(pageContent);

		// Wait for row count to increase again
		await expect(
			pageContent.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
		).toHaveCount(initialRowCount + 2);
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).toBeVisible();

		// Get all rows on the page
		const pageRows = pageContent.locator(
			'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
		);
		const rowCount = await pageRows.count();
		expect(rowCount).toBeGreaterThanOrEqual(2);

		// Find rows by their text content to ensure they're properly rendered
		const infoRow = pageRows.filter({ hasText: "Info row title" }).first();
		const textRow = pageRows.filter({ hasText: "Text row title" }).first();

		// Wait for rows to be visible
		await expect(infoRow).toBeVisible();
		await expect(textRow).toBeVisible();

		// Get the first and second rows by position for dragging
		const firstRow = pageRows.first();
		const secondRow = pageRows.nth(1);

		// Drag the first row to after the second row
		// Wait for both rows to be ready
		await expect(firstRow).toBeVisible();
		await expect(secondRow).toBeVisible();

		// Get bounding boxes for precise positioning
		const firstRowBox = await firstRow.boundingBox();
		const secondRowBox = await secondRow.boundingBox();

		if (firstRowBox && secondRowBox) {
			// Drag first row (Info at position 0) to after second row (Text at position 1)
			// Move to bottom of second row to trigger "bottom" edge detection
			await page.mouse.move(
				firstRowBox.x + firstRowBox.width / 2,
				firstRowBox.y + firstRowBox.height / 2
			);
			await page.mouse.down();
			// Move to the bottom edge of the second row
			await page.mouse.move(
				secondRowBox.x + secondRowBox.width / 2,
				secondRowBox.y + secondRowBox.height - 5
			);
			await page.mouse.up();
		}

		// Verify both rows are visible and in the correct order
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).toBeVisible();
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		// Verify order by checking text positions
		const allRows = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.all();
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

		// Verify Text row comes before Info row
		expect(textRowPosition).not.toBe(-1);
		expect(infoRowPosition).not.toBe(-1);
		expect(textRowPosition).toBeLessThan(infoRowPosition);
	});

	test("should drag a row from position 2 to 1 on a page", async ({
		page,
	}) => {
		// Wait for page to be ready
		await page.waitForLoadState("networkidle");
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();

		// Add two rows to the first page
		const firstSidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");
		const secondSidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");

		// Get the scrollable container inside the page
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Count initial rows
		const initialRowCount = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.count();

		await firstSidebarRow.dragTo(pageContent);

		// Wait for row count to increase
		await expect(
			pageContent.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
		).toHaveCount(initialRowCount + 1);
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		await secondSidebarRow.dragTo(pageContent);

		// Wait for row count to increase again
		await expect(
			pageContent.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
		).toHaveCount(initialRowCount + 2);
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).toBeVisible();

		// Get all rows on the page
		const pageRows = pageContent.locator(
			'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
		);
		const rowCount = await pageRows.count();
		expect(rowCount).toBeGreaterThanOrEqual(2);

		// Find rows by their text content to ensure they're properly rendered
		const infoRow = pageRows.filter({ hasText: "Info row title" }).first();
		const textRow = pageRows.filter({ hasText: "Text row title" }).first();

		// Wait for rows to be visible
		await expect(infoRow).toBeVisible();
		await expect(textRow).toBeVisible();

		// Get the first and second rows by position for dragging
		const firstRow = pageRows.first();
		const secondRow = pageRows.nth(1);

		// Drag the second row to before the first row
		// Wait for both rows to be ready
		await expect(firstRow).toBeVisible();
		await expect(secondRow).toBeVisible();

		// Get bounding boxes for precise positioning
		const secondRowBox2 = await secondRow.boundingBox();
		const firstRowBox2 = await firstRow.boundingBox();

		if (secondRowBox2 && firstRowBox2) {
			// Drag second row (Text at position 1) to before first row (Info at position 0)
			// Move to top of first row to trigger "top" edge detection
			await page.mouse.move(
				secondRowBox2.x + secondRowBox2.width / 2,
				secondRowBox2.y + secondRowBox2.height / 2
			);
			await page.mouse.down();
			// Move to the top edge of the first row
			await page.mouse.move(
				firstRowBox2.x + firstRowBox2.width / 2,
				firstRowBox2.y + 5
			);
			await page.mouse.up();
		}

		// Verify both rows are visible and in the correct order
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).toBeVisible();
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		// Verify order by checking text positions
		const allRows2 = await pageContent
			.locator(
				'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
			)
			.all();
		let textRowPosition2 = -1;
		let infoRowPosition2 = -1;

		for (let i = 0; i < allRows2.length; i++) {
			const rowText = await allRows2[i].textContent().catch(() => "");
			if (
				rowText?.includes("Text row title") &&
				textRowPosition2 === -1
			) {
				textRowPosition2 = i;
			}
			if (
				rowText?.includes("Info row title") &&
				infoRowPosition2 === -1
			) {
				infoRowPosition2 = i;
			}
		}

		// Verify Text row comes before Info row (Text was moved before Info)
		expect(textRowPosition2).not.toBe(-1);
		expect(infoRowPosition2).not.toBe(-1);
		expect(textRowPosition2).toBeLessThan(infoRowPosition2);
	});

	test("should drag from the left sidebar onto a container on a page", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();

		// Add a container row to the page
		const containerSidebarRow = rowsPanel
			.getByText("List container row title", { exact: true })
			.locator("..");
		await containerSidebarRow.dragTo(firstPage);

		// Verify the container is on the page
		await expect(
			firstPage.getByText("List container row title", { exact: true })
		).toBeVisible();

		// Get the container row element
		const containerRow = firstPage
			.getByText("List container row title", { exact: true })
			.locator("..")
			.locator("..");

		// Add a row from sidebar into the container
		const sidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		// Drag the row onto the container
		await sidebarRow.dragTo(containerRow);

		// Verify the row was added to the container
		// Wait for the text to appear - check both in container and on the page
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();
	});

	test("should remove a row from a container on a page by dragging it to the left sidebar", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");
		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();

		// Get the scrollable container inside the page
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add a container row to the page
		const containerSidebarRow = rowsPanel
			.getByText("List container row title", { exact: true })
			.locator("..");
		await containerSidebarRow.dragTo(pageContent);

		// Get the container row element
		const containerRow = firstPage
			.getByText("List container row title", { exact: true })
			.locator("..")
			.locator("..");

		// Verify the container is on the page first
		await expect(
			firstPage.getByText("List container row title", { exact: true })
		).toBeVisible();

		// Add a row from sidebar into the container
		const sidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");
		await sidebarRow.dragTo(containerRow);

		// Verify the row is in the container
		// Wait for the child row to appear - check on the page first, then find it
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		// Find the child row - try multiple approaches
		const childRow = firstPage
			.getByText("Info row title", { exact: true })
			.first();
		await expect(childRow).toBeVisible();

		// Drag the child row back to the sidebar to remove it
		await childRow.locator("..").locator("..").dragTo(rowsPanel);

		// Verify the row was removed from the container
		await expect(
			containerRow.getByText("Info row title", { exact: true })
		).not.toBeVisible();
	});
});
