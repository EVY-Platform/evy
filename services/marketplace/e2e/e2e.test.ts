import { Client } from "rpc-websockets";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { isRecord } from "../src/utils";

type WSClient = InstanceType<typeof Client>;

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}

const TEST_TOKEN = "e2e-marketplace-token";
const TEST_OS = "Web";
const CONNECTION_TIMEOUT_MS = 5000;

function waitForClientOpen(
	ws: WSClient,
	timeoutMs = CONNECTION_TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const onOpen = () => {
			clearTimeout(timeout);
			ws.removeListener("error", onError);
			resolve();
		};
		const onError = (err: Error) => {
			clearTimeout(timeout);
			ws.removeListener("open", onOpen);
			reject(err);
		};
		const timeout = setTimeout(() => {
			ws.removeListener("open", onOpen);
			ws.removeListener("error", onError);
			reject(new Error("WebSocket connection timeout"));
		}, timeoutMs);
		ws.on("open", onOpen);
		ws.on("error", onError);
	});
}

describe("Marketplace E2E (via API WebSocket)", () => {
	let client: WSClient;

	beforeAll(async () => {
		client = new Client(API_URL);
		await waitForClientOpen(client);
		await client.login({ token: TEST_TOKEN, os: TEST_OS });
	});

	afterAll(() => {
		client.close();
	});

	it("get marketplace.items should return an array envelope", async () => {
		const result = await client.call("get", {
			service: "marketplace",
			resource: "items",
		});
		expect(result).toHaveProperty("metadata");
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("create then get marketplace.items round-trips data", async () => {
		const testData = {
			id: crypto.randomUUID(),
			testField: "e2e test value",
			nested: { value: 123 },
		};

		const created = await client.call("create", {
			service: "marketplace",
			resource: "items",
			data: testData,
		});

		expect(created).toHaveProperty("metadata");
		expect(created).toHaveProperty("data");
		expect(isRecord(created.data)).toBe(true);
		expect(created.data).toHaveProperty("id");
		expect(created.data).toHaveProperty("data");

		const got = await client.call("get", {
			service: "marketplace",
			resource: "items",
		});

		expect(Array.isArray(got.data)).toBe(true);
		expect(got.data.length).toBeGreaterThan(0);
		const matchingRecord = got.data.find(
			(entry: unknown) =>
				isRecord(entry) &&
				entry.testField === "e2e test value" &&
				isRecord(entry.nested) &&
				entry.nested.value === 123,
		);
		expect(isRecord(matchingRecord)).toBe(true);
	});

	it("create marketplace.items with filter.id creates row keyed by client UUID (iOS shape)", async () => {
		const clientId = crypto.randomUUID();
		const itemPayload = {
			id: clientId,
			title: "from-ios",
		};

		const created = await client.call("create", {
			service: "marketplace",
			resource: "items",
			filter: { id: clientId },
			data: itemPayload,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toHaveProperty("metadata");
		expect(created.metadata.order).toEqual([clientId]);
		expect(created).toHaveProperty("data");
		expect(isRecord(created.data)).toBe(true);
		expect(created.data).toHaveProperty("id", clientId);
		expect(created.data.data).toMatchObject({
			id: clientId,
			title: "from-ios",
		});

		const got = await client.call("get", {
			service: "marketplace",
			resource: "items",
			filter: { id: clientId },
		});

		expect(Array.isArray(got.data)).toBe(true);
		expect(got.data).toHaveLength(1);
		expect(got.metadata.order).toEqual([clientId]);
		expect(got.data[0]).toMatchObject({
			id: clientId,
			title: "from-ios",
		});
	});
});
