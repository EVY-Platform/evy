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
	it("new client subscribed after reconnect receives flowUpdated from upsert", async () => {
		const first = await connectAndLogin(
			API_URL,
			TEST_TOKEN,
			TEST_OS,
			"flowUpdated",
		);
		first.close();

		const second = await connectAndLogin(
			API_URL,
			`${TEST_TOKEN}-2`,
			TEST_OS,
			"flowUpdated",
		);

		const notifyPromise = waitForNotification(second, "flowUpdated");

		const caller = await connectAndLogin(
			API_URL,
			`${TEST_TOKEN}-caller`,
			TEST_OS,
		);

		const pageId = crypto.randomUUID();
		const upsertResult = await caller.call("upsert", {
			namespace: "evy",
			resource: "sdui",
			data: {
				id: crypto.randomUUID(),
				name: `Reconnect test ${Date.now()}`,
				pages: [{ id: pageId, title: "P", rows: [] }],
			},
		});

		const params = await notifyPromise;
		expect(params).toEqual(upsertResult);

		second.close();
		caller.close();
	});

	it("client observes close when connection is closed", async () => {
		const client = await connectAndLogin(
			API_URL,
			`${TEST_TOKEN}-close`,
			TEST_OS,
		);

		const closed = new Promise<void>((resolve) => {
			client.on("close", () => resolve());
		});

		client.close();
		await closed;
	});
});
