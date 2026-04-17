import { Client } from "rpc-websockets";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

type WSClient = InstanceType<typeof Client>;

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}

const TEST_TOKEN = "e2e-marketplace-token";
const TEST_OS = "Web";
const CONNECTION_TIMEOUT_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

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

	it("get marketplace.items should return an array", async () => {
		const result = await client.call("get", {
			namespace: "marketplace",
			resource: "items",
		});
		expect(Array.isArray(result)).toBe(true);
	});

	it("upsert then get marketplace.items round-trips data", async () => {
		const testData = {
			id: crypto.randomUUID(),
			testField: "e2e test value",
			nested: { value: 123 },
		};

		const upserted = await client.call("upsert", {
			namespace: "marketplace",
			resource: "items",
			data: testData,
		});

		expect(upserted).toHaveProperty("id");
		expect(upserted).toHaveProperty("data");
		expect(isRecord(upserted.data)).toBe(true);

		const got = await client.call("get", {
			namespace: "marketplace",
			resource: "items",
		});

		expect(Array.isArray(got)).toBe(true);
		expect(got.length).toBeGreaterThan(0);
		const matchingRecord = got.find(
			(entry: unknown) =>
				isRecord(entry) &&
				entry.testField === "e2e test value" &&
				isRecord(entry.nested) &&
				entry.nested.value === 123,
		);
		expect(isRecord(matchingRecord)).toBe(true);
	});
});
