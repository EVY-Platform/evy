import { test, expect } from "@playwright/test";

/**
 * Readiness gate: run once before the main e2e suite to ensure the web app
 * has loaded flows from the API (flow selector has options). Fails fast if
 * the app is not ready; does not change behavior or timeouts of other tests.
 */
test("web app is ready", async ({ page }) => {
	await page.goto("/");
	const flowSelector = page.locator("#flow-select");
	await expect(flowSelector).toBeVisible();
	await expect(flowSelector.locator("option").first()).toBeVisible();
	const optionCount = await flowSelector.locator("option").count();
	expect(optionCount).toBeGreaterThan(0);
});
