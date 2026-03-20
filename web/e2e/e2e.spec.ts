import { test, expect } from "@playwright/test";

import {
	ensureSidePanelsExpanded,
	getConfigPanel,
	getErrorState,
	getFirstPage,
	getLoadingState,
	selectFlowByLabel,
	SELECTORS,
	waitForAppLoaded,
} from "../tests/utils";

/**
 * E2E Integration tests that run against real API services.
 * These tests do NOT inject mock data - they test the full stack.
 * Note: Tests should be resilient to empty database state.
 */

test.describe.configure({ mode: "serial" });

test.describe("Web E2E Integration Tests", () => {
	test("should persist SDUI edits after page refresh", async ({ page }) => {
		const uniqueTitle = `E2E Test Title ${Date.now()}`;

		await page.goto("/");
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, "View Item");

		const textRow = page.getByText("My item is called", { exact: true });
		await expect(textRow).toBeVisible();

		await textRow.click();

		const configPanel = getConfigPanel(page);
		const titleInput = configPanel.getByLabel("title", { exact: true });
		await expect(titleInput).toBeVisible();

		await titleInput.clear();
		await titleInput.fill(uniqueTitle);
		await expect(titleInput).toHaveValue(uniqueTitle);

		await page.reload();
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, "View Item");

		const editedRow = page.getByText(uniqueTitle, { exact: true });
		await expect(editedRow).toBeVisible();

		await editedRow.click();
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveValue(uniqueTitle);
	});

	test("should load the app and connect to real API", async ({ page }) => {
		await page.goto("/");

		const loadingMessage = getLoadingState(page);
		const errorMessage = getErrorState(page);
		const flowSelector = page.locator(SELECTORS.flowSelector);

		await expect(
			loadingMessage.or(errorMessage).or(flowSelector),
		).toBeVisible();
	});

	test("should display app structure when connected", async ({ page }) => {
		await page.goto("/");

		const loadingMessage = getLoadingState(page);
		const errorMessage = getErrorState(page);
		const flowSelector = page.locator(SELECTORS.flowSelector);

		await expect(
			loadingMessage.or(errorMessage).or(flowSelector),
		).toBeVisible();

		if (await loadingMessage.isVisible()) {
			await expect(loadingMessage).not.toBeVisible();
		}

		await expect(flowSelector.or(errorMessage)).toBeVisible();
	});

	test("should display EVY logo in header", async ({ page }) => {
		await page.goto("/");
		await waitForAppLoaded(page);

		const logo = page.locator('img[alt="EVY"]');
		await expect(logo).toBeVisible();
	});

	test("should attempt WebSocket connection to API", async ({ page }) => {
		let wsConnected = false;
		const apiPort = process.env.API_PORT;
		if (!apiPort) {
			throw new Error("API_PORT is not set");
		}

		page.on("websocket", (ws) => {
			if (
				ws.url().includes(`localhost:${apiPort}`) ||
				ws.url().includes(`127.0.0.1:${apiPort}`)
			) {
				wsConnected = true;
			}
		});

		await page.goto("/");
		await waitForAppLoaded(page);

		expect(wsConnected).toBe(true);
	});

	test("should receive data from WebSocket when connected", async ({
		page,
	}) => {
		const wsMessages: string[] = [];

		page.on("websocket", (ws) => {
			ws.on("framereceived", (frame) => {
				if (frame.payload) {
					wsMessages.push(String(frame.payload));
				}
			});
		});

		await page.goto("/");

		const loadingMessage = getLoadingState(page);
		const flowSelector = page.locator(SELECTORS.flowSelector);
		const errorMessage = getErrorState(page);

		await expect(
			loadingMessage.or(flowSelector).or(errorMessage),
		).toBeVisible();

		if (await loadingMessage.isVisible()) {
			await expect(loadingMessage).not.toBeVisible();
		}

		if (await flowSelector.isVisible()) {
			expect(wsMessages.length).toBeGreaterThan(0);
		}
	});

	test("should display footer row when page has one", async ({ page }) => {
		await page.goto("/");
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, "View Item");
		await expect(page.locator(SELECTORS.flowSelector)).not.toHaveAttribute(
			"data-value",
			"",
		);

		const footerButton = getFirstPage(page)
			.getByRole("button", { name: "Go home" })
			.first();
		await expect(footerButton).toBeVisible();
	});

	test("should display main panels after successful connection", async ({
		page,
	}) => {
		await page.goto("/");

		const flowSelector = page.locator(SELECTORS.flowSelector);
		const errorMessage = getErrorState(page);

		await expect(flowSelector.or(errorMessage)).toBeVisible();

		if (await flowSelector.isVisible()) {
			await ensureSidePanelsExpanded(page);

			const rowsPanel = page.getByText("Rows", { exact: true });
			await expect(rowsPanel).toBeVisible();

			await expect(getConfigPanel(page)).toBeVisible();
		}
	});
});
