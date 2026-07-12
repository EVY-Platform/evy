import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import { Client } from "rpc-websockets";

type WSClient = InstanceType<typeof Client>;

const MARKETPLACE_SERVICE_ID = MARKETPLACE_SERVICE;
const MARKETPLACE_ITEMS_RESOURCE_ID = MARKETPLACE_RESOURCE.ITEMS;
const MARKETPLACE_REQUESTS_RESOURCE_ID = MARKETPLACE_RESOURCE.REQUESTS;

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}

const TEST_TOKEN = "e2e-marketplace-token";
const TEST_OS = "Web";
const CONNECTION_TIMEOUT_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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

	it("get marketplace items resource should return an array envelope", async () => {
		const result = await client.call("get", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
		});
		expect(Array.isArray(result)).toBe(true);
	});

	it("create then get marketplace items resource round-trips data", async () => {
		const testData = {
			id: crypto.randomUUID(),
			testField: "e2e test value",
			nested: { value: 123 },
		};

		const created = await client.call("create", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
			data: testData,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toHaveProperty("id");
		expect(created).toHaveProperty("data");

		const got = await client.call("get", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
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

	it("creates validated marketplace requests", async () => {
		const requestId = crypto.randomUUID();
		const request = {
			id: requestId,
			type: "pickup",
			item_id: crypto.randomUUID(),
			time: "2026-06-03T10:00:00",
			archived: false,
		};

		await client.call("create", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_REQUESTS_RESOURCE_ID,
			filter: { id: requestId },
			data: request,
		});

		const rows = await client.call("get", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_REQUESTS_RESOURCE_ID,
			filter: { id: requestId },
		});
		expect(rows).toEqual([request]);

		await expect(
			client.call("create", {
				service: MARKETPLACE_SERVICE_ID,
				resource: MARKETPLACE_REQUESTS_RESOURCE_ID,
				data: {
					id: crypto.randomUUID(),
					type: "shipping",
					item_id: crypto.randomUUID(),
				},
			}),
		).rejects.toThrow();
	});

	it("create marketplace items resource with filter.id creates row keyed by client UUID (iOS shape)", async () => {
		const clientId = crypto.randomUUID();
		const itemPayload = {
			id: clientId,
			title: "from-ios",
		};

		const created = await client.call("create", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
			filter: { id: clientId },
			data: itemPayload,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toHaveProperty("id", clientId);
		expect(created.data).toMatchObject({
			id: clientId,
			title: "from-ios",
		});

		const got = await client.call("get", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
			filter: { id: clientId },
		});

		expect(Array.isArray(got)).toBe(true);
		expect(got).toHaveLength(1);
		expect(got[0]).toMatchObject({
			id: clientId,
			title: "from-ios",
		});
	});
});
