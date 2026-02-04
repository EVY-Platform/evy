import { defineConfig } from "@playwright/test";

/**
 * E2E Playwright config for integration tests against real services.
 * Unlike the regular config, this does NOT auto-start the dev server
 * and expects services to already be running via docker-compose.
 */
export default defineConfig({
	testDir: "./e2e",
	timeout: 30000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: process.env.CI ? 1 : undefined,
	reporter: "line",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: {
				viewport: { width: 1280, height: 1700 },
				ignoreHTTPSErrors: true,
			},
		},
	],
	// No webServer config - services are started externally via docker-compose
});
