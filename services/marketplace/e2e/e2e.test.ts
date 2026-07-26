import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { waitForClientOpen } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "../src/resources";

type WSClient = InstanceType<typeof Client>;

const MARKETPLACE_SERVICE_ID = MARKETPLACE_SERVICE;
const MARKETPLACE_ITEMS_RESOURCE_ID = MARKETPLACE_RESOURCE.ITEMS;
const EVY_MESSAGES_RESOURCE = EVY_CORE_RESOURCE.MESSAGES;

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

describe("Marketplace E2E (via API WebSocket)", () => {
	let client: WSClient;

	beforeAll(async () => {
		client = new Client(API_URL);
		await waitForClientOpen(client, CONNECTION_TIMEOUT_MS);
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

	it("creates core messages via the EVY API", async () => {
		const messageId = crypto.randomUUID();
		const message = {
			fk: crypto.randomUUID(),
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
			archivedAt: null,
			status: "pending",
			data: { type: "pickup", time: "2026-06-03T10:00:00" },
		};

		const created = await client.call("create", {
			service: EVY_CORE_SERVICE,
			resource: EVY_MESSAGES_RESOURCE,
			filter: { id: messageId },
			data: message,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toMatchObject({
			id: messageId,
			status: "pending",
			visibility: "public",
		});
		expect(created.updatedAt).toBeDefined();

		const rows = await client.call("get", {
			service: EVY_CORE_SERVICE,
			resource: EVY_MESSAGES_RESOURCE,
			filter: { id: messageId },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: messageId, status: "pending" });
	});

	it("create marketplace item with transfer_options.pickup.address_id round-trips", async () => {
		const clientId = crypto.randomUUID();
		const addressId = crypto.randomUUID();
		const itemPayload = {
			id: clientId,
			title: "item-with-address",
			transfer_options: {
				pickup: {
					address_id: addressId,
					lead_time_hours: "24",
				},
			},
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
			title: "item-with-address",
			transfer_options: {
				pickup: { address_id: addressId, lead_time_hours: "24" },
			},
		});
		expect(created.data).not.toHaveProperty("pickup_address");

		const got = await client.call("get", {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_ITEMS_RESOURCE_ID,
			filter: { id: clientId },
		});

		expect(Array.isArray(got)).toBe(true);
		expect(got).toHaveLength(1);
		expect(got[0]).toMatchObject({
			id: clientId,
			title: "item-with-address",
			transfer_options: {
				pickup: { address_id: addressId },
			},
		});
		expect(got[0]).not.toHaveProperty("pickup_address");
	});
});
