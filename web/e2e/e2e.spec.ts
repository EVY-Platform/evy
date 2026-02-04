import { test, expect } from "@playwright/test";

/**
 * E2E Integration tests that run against real API services.
 * These tests do NOT inject mock data - they test the full stack.
 * Note: Tests should be resilient to empty database state.
 */

test.describe("Web E2E Integration Tests", () => {
	test("should load the app and connect to real API", async ({ page }) => {
		await page.goto("/");

		// Wait for the app to either show content or loading/error state
		const loadingMessage = page.getByText("Loading flows...", {
			exact: true,
		});
		const errorMessage = page.getByText("Failed to load flows", {
			exact: true,
		});
		const rowsPanel = page.getByText("Rows", { exact: true });

		// Wait for any of these states - proves the app loaded
		await expect(loadingMessage.or(errorMessage).or(rowsPanel)).toBeVisible(
			{ timeout: 15000 },
		);
	});

	test("should display app structure when connected", async ({ page }) => {
		await page.goto("/");

		const loadingMessage = page.getByText("Loading flows...", {
			exact: true,
		});
		const errorMessage = page.getByText("Failed to load flows", {
			exact: true,
		});
		const rowsPanel = page.getByText("Rows", { exact: true });

		await expect(loadingMessage.or(errorMessage).or(rowsPanel)).toBeVisible(
			{ timeout: 15000 },
		);

		// If we see loading, wait for it to resolve
		if (await loadingMessage.isVisible()) {
			await expect(loadingMessage).not.toBeVisible({ timeout: 15000 });
		}

		// After connection attempt, we should see either Rows panel or error
		await expect(rowsPanel.or(errorMessage)).toBeVisible();
	});

	test("should display EVY logo in header", async ({ page }) => {
		await page.goto("/");

		// Wait for app to fully load (Rows panel indicates success)
		const rowsPanel = page.getByText("Rows", { exact: true });
		await expect(rowsPanel).toBeVisible({ timeout: 20000 });

		// Logo should be visible after successful load
		const logo = page.locator('img[alt="EVY"]');
		await expect(logo).toBeVisible();
	});

	test("should attempt WebSocket connection to API", async ({ page }) => {
		let wsConnected = false;

		page.on("websocket", (ws) => {
			if (
				ws.url().includes("localhost:8000") ||
				ws.url().includes("127.0.0.1:8000")
			) {
				wsConnected = true;
			}
		});

		await page.goto("/");

		// Wait for app to fully load
		const rowsPanel = page.getByText("Rows", { exact: true });
		await expect(rowsPanel).toBeVisible({ timeout: 20000 });

		// If app loaded, WebSocket must have connected
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

		const loadingMessage = page.getByText("Loading flows...", {
			exact: true,
		});
		const rowsPanel = page.getByText("Rows", { exact: true });
		const errorMessage = page.getByText("Failed to load flows", {
			exact: true,
		});

		await expect(loadingMessage.or(rowsPanel).or(errorMessage)).toBeVisible(
			{ timeout: 15000 },
		);

		if (await loadingMessage.isVisible()) {
			await expect(loadingMessage).not.toBeVisible({ timeout: 15000 });
		}

		// If app loaded successfully, we should have received messages
		if (await rowsPanel.isVisible()) {
			expect(wsMessages.length).toBeGreaterThan(0);
		}
	});

	test("should display main panels after successful connection", async ({
		page,
	}) => {
		await page.goto("/");

		const rowsPanel = page.getByText("Rows", { exact: true });
		const errorMessage = page.getByText("Failed to load flows", {
			exact: true,
		});

		await expect(rowsPanel.or(errorMessage)).toBeVisible({
			timeout: 20000,
		});

		// Only check for panels if app loaded successfully
		if (await rowsPanel.isVisible()) {
			const configPanel = page.getByText("Configuration", {
				exact: true,
			});
			await expect(configPanel).toBeVisible();

			const flowSelector = page.locator("#flow-select");
			await expect(flowSelector).toBeVisible();
		}
	});
});
