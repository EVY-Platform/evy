import { defineConfig } from "@playwright/test";

if (!process.env.WEB_PORT) throw new Error("WEB_PORT is required");
const url = `http://localhost:${process.env.WEB_PORT}`;
const timeout = 30_000;

export default defineConfig({
	timeout,
	expect: { timeout },
	retries: 1,
	fullyParallel: true,
	workers: 4,
	reporter: [["line"], ["html", { open: "never" }]],
	use: {
		baseURL: url,
		screenshot: "only-on-failure",
		trace: "on-first-retry",
		video: "retain-on-failure",
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
		url,
		reuseExistingServer: true,
		timeout,
	},
});
