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

	it("get marketplace.items should return an array", async () => {
		const result = await client.call("get", {
			service: "marketplace",
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
			service: "marketplace",
			resource: "items",
			data: testData,
		});

		expect(upserted).toHaveProperty("id");
		expect(upserted).toHaveProperty("data");
		expect(isRecord(upserted.data)).toBe(true);

		const got = await client.call("get", {
			service: "marketplace",
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

	it("searches marketplace items by tagIds and returns ordered ids", async () => {
		const matchingOlderId = crypto.randomUUID();
		const matchingNewerId = crypto.randomUUID();
		const nonMatchingId = crypto.randomUUID();

		for (const itemPayload of [
			{
				id: matchingOlderId,
				title: "Search matching older",
				tags: [{ id: "e2e-search-tag", value: "E2E Search" }],
			},
			{
				id: nonMatchingId,
				title: "Search non-matching",
				tags: [{ id: "e2e-other-tag", value: "Other" }],
			},
			{
				id: matchingNewerId,
				title: "Search matching newer",
				tags: [{ id: "e2e-search-tag", value: "E2E Search" }],
			},
		]) {
			await client.call("upsert", {
				service: "marketplace",
				resource: "items",
				filter: { ids: [itemPayload.id] },
				data: itemPayload,
			});
		}

		const result = await client.call("api", {
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				ids: [matchingNewerId, matchingOlderId, nonMatchingId],
				tagIds: ["e2e-search-tag"],
				limit: 10,
			},
		});

		expect(result).toEqual([matchingNewerId, matchingOlderId]);
	});

	it("upsert marketplace.items with filter.ids creates row keyed by client UUID (iOS shape)", async () => {
		const clientId = crypto.randomUUID();
		const itemPayload = {
			id: clientId,
			title: "from-ios",
		};

		const upserted = await client.call("upsert", {
			service: "marketplace",
			resource: "items",
			filter: { ids: [clientId] },
			data: itemPayload,
		});

		expect(isRecord(upserted)).toBe(true);
		expect(upserted).toHaveProperty("id", clientId);
		expect(upserted).toHaveProperty("data");
		expect(isRecord(upserted.data)).toBe(true);
		expect(upserted.data).toMatchObject({
			id: clientId,
			title: "from-ios",
		});

		const got = await client.call("get", {
			service: "marketplace",
			resource: "items",
			filter: { ids: [clientId] },
		});

		expect(Array.isArray(got)).toBe(true);
		expect(got).toHaveLength(1);
		expect(got[0]).toMatchObject({
			id: clientId,
			title: "from-ios",
		});
	});
});
