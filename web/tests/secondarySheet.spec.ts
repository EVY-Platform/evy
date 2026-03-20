import { expect, test } from "@playwright/test";
import {
	enterCanvasFocusModeByPageTitle,
	getFirstPage,
	getSecondarySheetPage,
	initTestFlows,
	openSecondarySheetChildFromConfigPanel,
} from "./utils";

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

	test("should open secondary page when clicking children in config panel in focus mode", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterCanvasFocusModeByPageTitle(page, "Page 1");

		const secondaryPage = getSecondarySheetPage(page);
		await expect(secondaryPage).toHaveCSS("opacity", "0");

		await openSecondarySheetChildFromConfigPanel(page);

		await expect(secondaryPage).toHaveCSS("opacity", "1");
	});

	test("should show SheetContainer children in secondary page", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterCanvasFocusModeByPageTitle(page, "Page 1");

		await openSecondarySheetChildFromConfigPanel(page);

		const secondaryPage = getSecondarySheetPage(page);
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		await expect(secondaryPage.getByText("Sheet Child 1")).toBeVisible();
		await expect(secondaryPage.getByText("Sheet Child 2")).toBeVisible();
	});

	test("should show sheet title in secondary page", async ({ page }) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterCanvasFocusModeByPageTitle(page, "Page 1");

		await openSecondarySheetChildFromConfigPanel(page);

		const secondaryPage = getSecondarySheetPage(page);
		await expect(secondaryPage).toHaveCSS("opacity", "1");
		await expect(secondaryPage.getByText("My Sheet")).toBeVisible();
	});

	test("should dismiss secondary page when navigating back in config panel", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterCanvasFocusModeByPageTitle(page, "Page 1");

		await openSecondarySheetChildFromConfigPanel(page);

		const secondaryPage = getSecondarySheetPage(page);
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		await page.getByRole("button", { name: "Configure row: My Sheet" }).click();

		await expect(secondaryPage).toHaveCSS("opacity", "0");
	});

	test("should dismiss secondary page when clicking canvas background", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await enterCanvasFocusModeByPageTitle(page, "Page 1");

		await openSecondarySheetChildFromConfigPanel(page);

		const secondaryPage = getSecondarySheetPage(page);
		await expect(secondaryPage).toHaveCSS("opacity", "1");

		// Click canvas background away from side panels (they overlay the viewport edges).
		const canvas = page.getByTestId("canvas-viewport");
		const canvasBox = await canvas.boundingBox();
		if (canvasBox) {
			await canvas.click({
				position: {
					x: canvasBox.width / 2,
					y: Math.min(120, canvasBox.height / 2),
				},
			});
		}

		await expect(secondaryPage).toHaveCSS("opacity", "0");
	});

	test("should auto-enter focus mode when clicking SheetContainer children outside focus mode", async ({
		page,
	}) => {
		await initTestFlows(page, sheetContainerPage);
		await page.goto("/");

		await getFirstPage(page).click();
		await openSecondarySheetChildFromConfigPanel(page);

		const pageBreadcrumb = page.getByRole("button", {
			name: "Select page Page 1",
		});
		await expect(pageBreadcrumb).toHaveAttribute("aria-current", "page");
		const secondaryPage = getSecondarySheetPage(page);
		await expect(secondaryPage).toHaveCSS("opacity", "1");
	});
});
