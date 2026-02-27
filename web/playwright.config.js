import { defineConfig } from "@playwright/test";

function requireEnv(name) {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`${name} is required (copy .env.example to .env for dev)`);
	}
	return value;
}

const WEB_PORT = requireEnv("WEB_PORT");

export default defineConfig({
	testDir: "./tests",
	timeout: 10000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 1,
	reporter: "line",
	use: {
		baseURL: `http://localhost:${WEB_PORT}`,
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
		url: `http://localhost:${WEB_PORT}`,
		reuseExistingServer: !process.env.CI,
	},
});
