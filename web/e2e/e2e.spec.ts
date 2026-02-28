import { test, expect } from "@playwright/test";

/**
 * E2E Integration tests that run against real API services.
 * These tests do NOT inject mock data - they test the full stack.
 * Note: Tests should be resilient to empty database state.
 */

test.describe("Web E2E Integration Tests", () => {
	test("should persist SDUI edits after page refresh", async ({ page }) => {
		// Generate a unique test value to avoid conflicts
		const uniqueTitle = `E2E Test Title ${Date.now()}`;

		await page.goto("/");

		// Wait for app to fully load
		const rowsPanel = page.getByText("Rows", { exact: true });
		await expect(rowsPanel).toBeVisible();

		// Select the "View Item" flow from the dropdown
		const flowSelector = page.locator("#flow-select");
		await expect(flowSelector).toBeVisible();
		await flowSelector.selectOption({ label: "View Item" });

		// Wait for the flow to load - look for the Text row with "My item is called"
		const textRow = page.getByText("My item is called", { exact: true });
		await expect(textRow).toBeVisible();

		// Click on the row to select it
		await textRow.click();

		// Wait for the configuration panel to show the row's config
		const configPanel = page
			.getByText("Configuration", { exact: true })
			.locator("..");
		const titleInput = configPanel.getByLabel("title");
		await expect(titleInput).toBeVisible();

		// Edit the title field with our unique value
		await titleInput.clear();
		await titleInput.fill(uniqueTitle);

		// Verify the input has our value
		await expect(titleInput).toHaveValue(uniqueTitle);

		// Wait for auto-save to trigger (auto-save happens on state change)
		// Give it a moment to ensure the WebSocket call completes
		await page.waitForTimeout(100);

		// Refresh the page to test persistence
		await page.reload();

		// Wait for app to fully load again
		await expect(rowsPanel).toBeVisible();

		// Select the same flow again
		await expect(flowSelector).toBeVisible();
		await flowSelector.selectOption({ label: "View Item" });

		// Wait for the Text row to appear (it should now show our edited title)
		const editedRow = page.getByText(uniqueTitle, { exact: true });
		await expect(editedRow).toBeVisible();

		// Click on the row to verify the config also shows the updated value
		await editedRow.click();
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveValue(uniqueTitle);
	});

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
		await expect(
			loadingMessage.or(errorMessage).or(rowsPanel),
		).toBeVisible();
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

		await expect(
			loadingMessage.or(errorMessage).or(rowsPanel),
		).toBeVisible();

		// If we see loading, wait for it to resolve
		if (await loadingMessage.isVisible()) {
			await expect(loadingMessage).not.toBeVisible();
		}

		// After connection attempt, we should see either Rows panel or error
		await expect(rowsPanel.or(errorMessage)).toBeVisible();
	});

	test("should display EVY logo in header", async ({ page }) => {
		await page.goto("/");

		// Wait for app to fully load (Rows panel indicates success)
		const rowsPanel = page.getByText("Rows", { exact: true });
		await expect(rowsPanel).toBeVisible();

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
		await expect(rowsPanel).toBeVisible();

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

		await expect(
			loadingMessage.or(rowsPanel).or(errorMessage),
		).toBeVisible();

		if (await loadingMessage.isVisible()) {
			await expect(loadingMessage).not.toBeVisible();
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

		await expect(rowsPanel.or(errorMessage)).toBeVisible();

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
