import { defineConfig } from "@playwright/test";

if (!process.env.WEB_PORT) throw new Error("WEB_PORT is required");
const url = `http://localhost:${process.env.WEB_PORT}`;

export default defineConfig({
	timeout: 10000,
	fullyParallel: true,
	workers: 4,
	reporter: [["line"], ["html", { open: "never" }]],
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
