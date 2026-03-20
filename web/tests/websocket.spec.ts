import { expect, test } from "@playwright/test";
import {
	ensureSidePanelsExpanded,
	getConfigPanel,
	getErrorState,
	getLoadingState,
	initTestFlows,
} from "./utils";

test.describe("WebSocket Connection States", () => {
	test("should display loading or error state when no API is available", async ({
		page,
	}) => {
		// Navigate without injecting test flows - this will trigger real WebSocket connection
		// Since the API server isn't running, we should see either loading or error state
		await page.goto("/");

		const loadingMessage = getLoadingState(page);
		const errorMessage = getErrorState(page);

		// Wait for one of them to appear - this tests that the app shows a state when no API is available
		await expect(loadingMessage.or(errorMessage)).toBeVisible();
	});

	test("should display error state when connection fails", async ({ page }) => {
		await page.addInitScript(() => {
			window.WebSocket = class {
				constructor() {
					throw new Error("Forced WebSocket failure for test");
				}
			} as unknown as typeof WebSocket;
		});

		await page.goto("/");

		const errorMessage = getErrorState(page);
		await expect(errorMessage).toBeVisible();
	});

	test("should display app content when flows are loaded via test injection", async ({
		page,
	}) => {
		// Inject test flows to simulate successful connection
		await initTestFlows(page, [
			{
				id: "test-flow-1",
				title: "Test Page",
				rows: [],
			},
		]);
		await page.goto("/");
		await ensureSidePanelsExpanded(page);

		await expect(getLoadingState(page)).not.toBeVisible();
		await expect(getErrorState(page)).not.toBeVisible();

		const rowsPanel = page.getByText("Rows", { exact: true });
		await expect(rowsPanel).toBeVisible();

		await expect(getConfigPanel(page)).toBeVisible();
	});

	test("should display logo in header when app loads", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "test-flow-1",
				title: "Test Page",
				rows: [],
			},
		]);
		await page.goto("/");

		// Logo should be visible in the header
		const logo = page.locator('img[alt="EVY"]');
		await expect(logo).toBeVisible();
	});

	test("should have correct page structure after loading", async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "test-flow-1",
				title: "Test Page",
				rows: [],
			},
		]);
		await page.goto("/");
		await ensureSidePanelsExpanded(page);

		// Check the three main panels are present
		// Left panel: Rows
		const rowsPanel = page.getByText("Rows", { exact: true }).first();
		await expect(rowsPanel).toBeVisible();

		await expect(getConfigPanel(page)).toBeVisible();

		// Center: Phone mockup(s)
		const phoneContainer = page.locator('div[class*="evy-bg-phone"]');
		await expect(phoneContainer.first()).toBeVisible();
	});
});
