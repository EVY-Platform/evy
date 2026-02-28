import { defineConfig } from "@playwright/test";

if (!process.env.WEB_PORT) throw new Error("WEB_PORT is required");

export default defineConfig({
	timeout: 10000,
	fullyParallel: true,
	workers: 8,
	reporter: "line",
	use: {
		baseURL: `http://localhost:${process.env.WEB_PORT}`,
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
	webServer: {
		command: "bun run dev",
		url: `http://localhost:${process.env.WEB_PORT}`,
		reuseExistingServer: process.env.CI === "true",
	},
});
