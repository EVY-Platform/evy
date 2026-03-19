import { expect, test } from "@playwright/test";
import { getFirstPage, initTestFlows } from "./utils";

test.describe("Secondary Sheet Page", () => {
	const sheetContainerPage = [
		{
			id: "step_1",
			title: "Page 1",
			rows: [
				{
					id: "sheet-1",
					type: "SheetContainer" as const,
					view: {
						content: {
							title: "My Sheet",
							child: {
								type: "Info" as const,
								view: {
									content: {
										title: "Child Info",
										text: "Child text",
									},
								},
								actions: [],
							},
							children: [
								{
									type: "Text" as const,
									view: {
										content: {
											title: "Sheet Child 1",
											text: "Text 1",
										},
									},
									actions: [],
								},
								{
									type: "Text" as const,
									view: {
										content: {
											title: "Sheet Child 2",
											text: "Text 2",
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
	];

	async function openSecondaryViaConfigPanel(
		page: import("@playwright/test").Page,
	) {
		// Select the SheetContainer row on the page to show its config
		await page.getByText("My Sheet", { exact: true }).click();

		// The config panel should show "Children" with child buttons
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

		// Click the first children item (Text row) in the config panel
		const childButton = configPanel
			.getByRole("button", { name: "Text" })
			.first();
		await expect(childButton).toBeVisible();
		await childButton.click();
	}

	test("should open secondary page when clicking children in config panel in focus mode", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		// Select the page and enter focus mode
		const firstPage = getFirstPage(page);
		await firstPage.click();
		await page.getByRole("button", { name: "Focus" }).click();

		// Secondary should not be visible yet
		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "0");

		await openSecondaryViaConfigPanel(page);

		// The secondary sheet page should now be visible
		await expect(secondaryPage).toHaveCSS("opacity", "1");
	});

	test("should show SheetContainer children in secondary page", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		await firstPage.click();
		await page.getByRole("button", { name: "Focus" }).click();

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		await expect(secondaryPage.getByText("Sheet Child 1")).toBeVisible();
		await expect(secondaryPage.getByText("Sheet Child 2")).toBeVisible();
	});

	test("should show sheet title in secondary page", async ({ page }) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		await firstPage.click();
		await page.getByRole("button", { name: "Focus" }).click();

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");
		await expect(secondaryPage.getByText("My Sheet")).toBeVisible();
	});

	test("should dismiss secondary page when navigating back in config panel", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		await firstPage.click();
		await page.getByRole("button", { name: "Focus" }).click();

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		// Click the back button in the config panel
		const backButton = page.getByRole("button", { name: /Back to parent/ });
		await backButton.click();

		await expect(secondaryPage).toHaveCSS("opacity", "0");
	});

	test("should dismiss secondary page when clicking canvas background", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		const firstPage = getFirstPage(page);
		await firstPage.click();
		await page.getByRole("button", { name: "Focus" }).click();

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		// Click the canvas background
		const canvas = page.locator(".evy-flex-1.evy-flex.evy-p-4");
		const canvasBox = await canvas.boundingBox();
		if (canvasBox) {
			await page.mouse.click(
				canvasBox.x + canvasBox.width - 10,
				canvasBox.y + 10,
			);
		}

		await expect(secondaryPage).toHaveCSS("opacity", "0");
	});

	test("should auto-enter focus mode when clicking SheetContainer children outside focus mode", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		// Select the page and row, then ensure focus mode is off
		const firstPage = getFirstPage(page);
		await firstPage.click();
		const focusButton = page.getByRole("button", { name: "Focus" });

		// Turn off focus mode if it's on
		const isPressed = await focusButton.getAttribute("aria-pressed");
		if (isPressed === "true") {
			await focusButton.click();
			await expect(focusButton).toHaveAttribute("aria-pressed", "false");
		}

		// Select the SheetContainer row
		await page.getByText("My Sheet", { exact: true }).click();

		// Click a children item in the config panel
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		const childButton = configPanel
			.getByRole("button", { name: "Text" })
			.first();
		await expect(childButton).toBeVisible();
		await childButton.click();

		// Should auto-enter focus mode and show secondary page
		await expect(focusButton).toHaveAttribute("aria-pressed", "true");
		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");
	});
});
