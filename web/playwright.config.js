module.exports = {
	testDir: "./tests",
	timeout: 1000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
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
				viewport: { width: 1280, height: 720 },
				ignoreHTTPSErrors: true,
			},
		},
	],
	webServer: {
		command: "deno task dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
	},
};
