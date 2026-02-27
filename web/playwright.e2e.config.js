import { defineConfig } from "@playwright/test";

function requireEnv(name) {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`${name} is required (set by run-e2e.sh for e2e)`);
	}
	return value;
}

const WEB_PORT = requireEnv("WEB_PORT");

/**
 * E2E Playwright config for integration tests against real services.
 * Unlike the regular config, this does NOT auto-start the dev server
 * and expects services to already be running via docker-compose.
 */
export default defineConfig({
	testDir: "./e2e",
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
	// No webServer config - services are started externally via docker-compose
});
