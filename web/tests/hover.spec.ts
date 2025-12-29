import { test, expect } from "@playwright/test";
import { initTestFlows } from "./utils.tsx";

test.describe("Drag Hover Indicator Behavior", () => {
	test.beforeEach(async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [],
			},
		]);
		await page.goto("/");
	});

	test("should show drop indicator when hovering over a row on a page", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const sidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add a row to the page to hover over
		const targetSidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");
		await targetSidebarRow.dragTo(pageContent);

		// Wait for the row to be added
		await expect(
			firstPage.getByText("Text row title", { exact: true })
		).toBeVisible();

		// Get the row element
		const pageRow = firstPage
			.getByText("Text row title", { exact: true })
			.locator("..")
			.locator("..");

		// Start dragging from sidebar
		const sidebarBox = await sidebarRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (sidebarBox && rowBox) {
			await page.mouse.move(
				sidebarBox.x + sidebarBox.width / 2,
				sidebarBox.y + sidebarBox.height / 2
			);
			await page.mouse.down();

			// Move over the page row
			await page.mouse.move(
				rowBox.x + rowBox.width / 2,
				rowBox.y + rowBox.height / 2
			);

			// Check for drop indicator
			const dropIndicator = page.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(dropIndicator).toBeVisible();

			await page.mouse.up();
		}
	});

	test("should show drop indicator inside a container when hovering over container children", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add a container to the page
		const containerSidebarRow = rowsPanel
			.getByText("List container row title", { exact: true })
			.locator("..");
		await containerSidebarRow.dragTo(pageContent);

		// Verify the container is on the page
		await expect(
			firstPage.getByText("List container row title", { exact: true })
		).toBeVisible();

		// Add a child row to the container
		const childSidebarRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		const containerRow = firstPage
			.getByText("List container row title", { exact: true })
			.locator("..")
			.locator("..");

		await childSidebarRow.dragTo(containerRow);

		// Verify the child is in the container
		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		// Now drag another row and hover over the child inside the container
		const dragRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");

		const childRow = firstPage
			.getByText("Info row title", { exact: true })
			.locator("..")
			.locator("..");

		const dragBox = await dragRow.boundingBox();
		const childBox = await childRow.boundingBox();

		if (dragBox && childBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move over the child row inside the container
			await page.mouse.move(
				childBox.x + childBox.width / 2,
				childBox.y + childBox.height / 2
			);

			// Check for drop indicator inside the container
			const dropIndicator = childRow.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(dropIndicator.first()).toBeVisible();

			await page.mouse.up();
		}
	});

	test("should show only one drop indicator at a time", async ({ page }) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add multiple rows to the page
		const rowTypes = [
			"Info row title",
			"Text row title",
			"Button row text",
		];
		for (const rowText of rowTypes) {
			const sidebarRow = rowsPanel
				.getByText(rowText, { exact: true })
				.locator("..");
			await sidebarRow.dragTo(pageContent);
			await expect(
				firstPage.getByText(rowText, { exact: true })
			).toBeVisible();
		}

		// Get all rows on the page
		const pageRows = pageContent.locator(
			'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
		);

		const dragRow = rowsPanel
			.getByText("Calendar row title", { exact: true })
			.locator("..");

		const firstPageRow = pageRows.first();
		const secondPageRow = pageRows.nth(1);

		const dragBox = await dragRow.boundingBox();
		const firstRowBox = await firstPageRow.boundingBox();
		const secondRowBox = await secondPageRow.boundingBox();

		if (dragBox && firstRowBox && secondRowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move over first row
			await page.mouse.move(
				firstRowBox.x + firstRowBox.width / 2,
				firstRowBox.y + firstRowBox.height / 2
			);

			// Count visible indicators - should be exactly 1
			const indicators = page.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			const count = await indicators.count();
			expect(count).toBe(1);

			// Move to second row
			await page.mouse.move(
				secondRowBox.x + secondRowBox.width / 2,
				secondRowBox.y + secondRowBox.height / 2
			);

			// Should still be exactly 1 indicator
			const count2 = await indicators.count();
			expect(count2).toBe(1);

			await page.mouse.up();
		}
	});

	test("should show indicator for innermost row when hovering over nested containers", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add outer container
		const outerContainerRow = rowsPanel
			.getByText("List container row title", { exact: true })
			.locator("..");
		await outerContainerRow.dragTo(pageContent);

		await expect(
			firstPage.getByText("List container row title", { exact: true })
		).toBeVisible();

		const outerContainer = firstPage
			.getByText("List container row title", { exact: true })
			.locator("..")
			.locator("..");

		// Add inner container inside outer container
		const innerContainerRow = rowsPanel
			.getByText("Column container row title", { exact: true })
			.locator("..");
		await innerContainerRow.dragTo(outerContainer);

		// Find the inner container element
		const innerContainer = firstPage
			.getByText("Column container row title", { exact: true })
			.locator("..")
			.locator("..");

		// Add a child row inside the inner container
		const childRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");
		await childRow.dragTo(innerContainer);

		await expect(
			firstPage.getByText("Info row title", { exact: true })
		).toBeVisible();

		// Now drag and hover over the innermost child
		const dragRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");

		// Find the actual child row element inside the nested structure
		const childRowElement = firstPage
			.getByText("Info row title", { exact: true })
			.locator("..")
			.locator("..");

		const dragBox = await dragRow.boundingBox();
		const childBox = await childRowElement.boundingBox();

		if (dragBox && childBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move over the innermost child row
			await page.mouse.move(
				childBox.x + childBox.width / 2,
				childBox.y + childBox.height / 2
			);

			// The indicator should appear on the innermost row
			const dropIndicator = childRowElement.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(dropIndicator.first()).toBeVisible();

			// Verify only one indicator is visible
			const allIndicators = page.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			const count = await allIndicators.count();
			expect(count).toBe(1);

			await page.mouse.up();
		}
	});

	test("should clear indicator when drag ends", async ({ page }) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add a row to the page
		const targetSidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");
		await targetSidebarRow.dragTo(pageContent);

		const pageRow = firstPage
			.getByText("Text row title", { exact: true })
			.locator("..")
			.locator("..");

		const dragRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		const dragBox = await dragRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (dragBox && rowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move over the row
			await page.mouse.move(
				rowBox.x + rowBox.width / 2,
				rowBox.y + rowBox.height / 2
			);

			// Verify indicator is visible
			const dropIndicator = page.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(dropIndicator).toBeVisible();

			// Release the mouse
			await page.mouse.up();

			// Verify indicator is no longer visible
			const indicatorAfterDrop = page.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(indicatorAfterDrop).not.toBeVisible();
		}
	});

	test("should switch indicator when moving between rows", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add two rows to the page
		const rowTypes = ["Info row title", "Text row title"];
		for (const rowText of rowTypes) {
			const sidebarRow = rowsPanel
				.getByText(rowText, { exact: true })
				.locator("..");
			await sidebarRow.dragTo(pageContent);
			await expect(
				firstPage.getByText(rowText, { exact: true })
			).toBeVisible();
		}

		const pageRows = pageContent.locator(
			'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]'
		);

		const dragRow = rowsPanel
			.getByText("Button row text", { exact: true })
			.locator("..");

		const firstPageRow = pageRows
			.filter({ hasText: "Info row title" })
			.first();
		const secondPageRow = pageRows
			.filter({ hasText: "Text row title" })
			.first();

		const dragBox = await dragRow.boundingBox();
		const firstRowBox = await firstPageRow.boundingBox();
		const secondRowBox = await secondPageRow.boundingBox();

		if (dragBox && firstRowBox && secondRowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move over first row
			await page.mouse.move(
				firstRowBox.x + firstRowBox.width / 2,
				firstRowBox.y + firstRowBox.height / 2
			);

			// Verify indicator is on first row
			const firstIndicator = firstPageRow.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(firstIndicator.first()).toBeVisible();

			// Move to second row
			await page.mouse.move(
				secondRowBox.x + secondRowBox.width / 2,
				secondRowBox.y + secondRowBox.height / 2
			);

			// Verify indicator is now on second row (first row should not have it)
			const secondIndicator = secondPageRow.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			await expect(secondIndicator.first()).toBeVisible();

			// Verify only one indicator is visible total
			const allIndicators = page.locator(
				'[class*="evy-drop-indicator-top"], [class*="evy-drop-indicator-bottom"]'
			);
			const count = await allIndicators.count();
			expect(count).toBe(1);

			await page.mouse.up();
		}
	});

	test("should show indicator at top edge when hovering near top of row", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add a row to the page
		const targetSidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");
		await targetSidebarRow.dragTo(pageContent);

		const pageRow = firstPage
			.getByText("Text row title", { exact: true })
			.locator("..")
			.locator("..");

		const dragRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		const dragBox = await dragRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (dragBox && rowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move to the top edge of the row
			await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + 10);

			// Check for top indicator
			const topIndicator = pageRow.locator(
				'[class*="evy-drop-indicator-top"]'
			);
			await expect(topIndicator.first()).toBeVisible();

			await page.mouse.up();
		}
	});

	test("should show indicator at bottom edge when hovering near bottom of row", async ({
		page,
	}) => {
		const rowsPanel = page
			.getByText("Rows", { exact: true })
			.first()
			.locator("..");

		const firstPage = page.locator('div[class*="evy-bg-phone"]').first();
		const pageContent = firstPage.locator('[class*="evy-overflow-scroll"]');

		// Add a row to the page
		const targetSidebarRow = rowsPanel
			.getByText("Text row title", { exact: true })
			.locator("..");
		await targetSidebarRow.dragTo(pageContent);

		const pageRow = firstPage
			.getByText("Text row title", { exact: true })
			.locator("..")
			.locator("..");

		const dragRow = rowsPanel
			.getByText("Info row title", { exact: true })
			.locator("..");

		const dragBox = await dragRow.boundingBox();
		const rowBox = await pageRow.boundingBox();

		if (dragBox && rowBox) {
			await page.mouse.move(
				dragBox.x + dragBox.width / 2,
				dragBox.y + dragBox.height / 2
			);
			await page.mouse.down();

			// Move to the bottom edge of the row
			await page.mouse.move(
				rowBox.x + rowBox.width / 2,
				rowBox.y + rowBox.height - 10
			);

			// Check for bottom indicator
			const bottomIndicator = pageRow.locator(
				'[class*="evy-drop-indicator-bottom"]'
			);
			await expect(bottomIndicator.first()).toBeVisible();

			await page.mouse.up();
		}
	});
});
