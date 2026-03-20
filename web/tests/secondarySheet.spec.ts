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

	async function enterFocusMode(page: import("@playwright/test").Page) {
		const firstPage = getFirstPage(page);
		await firstPage.click();
		const pageBreadcrumb = page.getByRole("button", {
			name: "Select page Page 1",
		});
		await pageBreadcrumb.click();
	}

	async function openSecondaryViaConfigPanel(
		page: import("@playwright/test").Page,
	) {
		await page.getByText("My Sheet", { exact: true }).click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");

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

		await enterFocusMode(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "0");

		await openSecondaryViaConfigPanel(page);

		await expect(secondaryPage).toHaveCSS("opacity", "1");
	});

	test("should show SheetContainer children in secondary page", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterFocusMode(page);

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		await expect(secondaryPage.getByText("Sheet Child 1")).toBeVisible();
		await expect(secondaryPage.getByText("Sheet Child 2")).toBeVisible();
	});

	test("should show sheet title in secondary page", async ({ page }) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterFocusMode(page);

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

		await enterFocusMode(page);

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		await page.getByRole("button", { name: "Configure row: My Sheet" }).click();

		await expect(secondaryPage).toHaveCSS("opacity", "0");
	});

	test("should dismiss secondary page when clicking canvas background", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterFocusMode(page);

		await openSecondaryViaConfigPanel(page);

		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		const canvas = page.locator('[data-testid="canvas-viewport"]');
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

		const firstPage = getFirstPage(page);
		await firstPage.click();

		await page.getByText("My Sheet", { exact: true }).click();

		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		const childButton = configPanel
			.getByRole("button", { name: "Text" })
			.first();
		await expect(childButton).toBeVisible();
		await childButton.click();

		const pageBreadcrumb = page.getByRole("button", {
			name: "Select page Page 1",
		});
		await expect(pageBreadcrumb).toHaveAttribute("aria-current", "page");
		const secondaryPage = page.locator('[data-testid="secondary-sheet-page"]');
		await expect(secondaryPage).toHaveCSS("opacity", "1");
	});
});
