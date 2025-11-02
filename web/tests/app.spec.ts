import { test, expect } from "@playwright/test";
import { initTestFlows } from "./utils.tsx";

test.describe("App state and layout", () => {
	test.beforeEach(async ({ page }) => {
		await initTestFlows(page, [
			{
				id: "step_1",
				title: "Page 1",
				rows: [
					{
						type: "Info",
						view: {
							content: {
								title: "Welcome",
								text: "This is page 1",
							},
						},
					},
				],
			},
			{
				id: "step_2",
				title: "Page 2",
				rows: [
					{
						type: "Button",
						view: {
							content: {
								title: "",
								label: "Submit",
							},
						},
						action: {
							target: "close",
						},
					},
				],
			},
		]);
		await page.goto("/");
	});

	test("should load the application with initial state", async ({ page }) => {
		// Check that the main layout is present
		await expect(page.locator('img[alt="EVY"]')).toBeVisible();

		// Check that the Rows panel is present
		await expect(
			page.getByText("Rows", { exact: true }).first()
		).toBeVisible();

		// Check that the Configuration panel header is present (even if content is not visible)
		await expect(
			page.getByText("Configuration", { exact: true })
		).toBeVisible();

		// Check that there are two empty pages by looking for the phone background images
		// We can identify phone containers by looking for elements with phone background class
		const phoneContainers = page.locator('div[class*="evy-bg-phone"]');
		await expect(phoneContainers).toHaveCount(2);

		// Check that the configuration panel content is empty initially (no forms visible)
		await expect(
			page
				.getByText("Configuration", { exact: true })
				.locator("..")
				.locator("form")
		).toHaveCount(0);
	});
});
