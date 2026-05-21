import { describe, expect, it } from "bun:test";

import {
	connectAndLogin,
	waitForNotification,
} from "../src/tests/wsTestHelpers";

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}

const TEST_TOKEN = "e2e-reconnect-token";
const TEST_OS = "Web";

describe("API E2E WebSocket reconnect", () => {
	it("new client subscribed after reconnect receives dataChanged from create", async () => {
		const first = await connectAndLogin(
			API_URL,
			TEST_TOKEN,
			TEST_OS,
			"dataChanged",
		);
		first.close();

		const second = await connectAndLogin(
			API_URL,
			`${TEST_TOKEN}-2`,
			TEST_OS,
			"dataChanged",
		);

		const notifyPromise = waitForNotification(second, "dataChanged");

		const caller = await connectAndLogin(
			API_URL,
			`${TEST_TOKEN}-caller`,
			TEST_OS,
		);

		const pageId = crypto.randomUUID();
		const createResult = await caller.call("create", {
			service: "evy",
			resource: "sdui",
			data: {
				id: crypto.randomUUID(),
				name: `Reconnect test ${Date.now()}`,
				pages: [{ id: pageId, title: "P", rows: [] }],
			},
		});

		const params = await notifyPromise;
		expect(params).toEqual({
			service: "evy",
			resource: "sdui",
			operation: "create",
			value: createResult.data,
		});

		second.close();
		caller.close();
	});
});
