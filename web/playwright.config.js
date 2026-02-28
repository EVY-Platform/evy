import { defineConfig } from "@playwright/test";

if (!process.env.WEB_PORT) throw new Error("WEB_PORT is required");
const url = `http://localhost:${process.env.WEB_PORT}`;

export default defineConfig({
	timeout: 20000,
	fullyParallel: false,
	workers: 4,
	reporter: "line",
	use: { baseURL: url },
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
		reuseExistingServer: true, // If server not reachable at url it will still do command
	},
});
