import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { waitForClientOpen } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";

type WSClient = InstanceType<typeof Client>;

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

type DiscoveredMarketplaceIds = {
	serviceId: string;
	itemsResourceId: string;
};

async function discoverMarketplaceIds(
	client: WSClient,
): Promise<DiscoveredMarketplaceIds> {
	const response = await client.call("resources", {});
	if (
		typeof response !== "object" ||
		response === null ||
		!("services" in response) ||
		!Array.isArray(response.services)
	) {
		throw new Error("Expected resources response with services array");
	}

	const marketplaceService = response.services.find(
		(service: { name?: string }) => service.name === "marketplace",
	);
	if (!marketplaceService || typeof marketplaceService.id !== "string") {
		throw new Error("Expected marketplace service in resources response");
	}

	const resources = Array.isArray(marketplaceService.resources)
		? marketplaceService.resources
		: [];
	const itemsResource = resources.find(
		(resource: { name?: string }) => resource.name === "items",
	);
	if (!itemsResource || typeof itemsResource.id !== "string") {
		throw new Error("Expected items resource in marketplace manifest");
	}

	return {
		serviceId: marketplaceService.id,
		itemsResourceId: itemsResource.id,
	};
}

describe("Marketplace E2E (via API WebSocket)", () => {
	let client: WSClient;
	let marketplaceServiceId: string;
	let itemsResourceId: string;

	beforeAll(async () => {
		client = new Client(API_URL);
		await waitForClientOpen(client, CONNECTION_TIMEOUT_MS);
		await client.login({ token: TEST_TOKEN, os: TEST_OS });

		const discovered = await discoverMarketplaceIds(client);
		marketplaceServiceId = discovered.serviceId;
		itemsResourceId = discovered.itemsResourceId;
	});

	afterAll(() => {
		client.close();
	});

	it("get marketplace items resource should return an array envelope", async () => {
		const result = await client.call("get", {
			service: marketplaceServiceId,
			resource: itemsResourceId,
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
			service: marketplaceServiceId,
			resource: itemsResourceId,
			data: testData,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toHaveProperty("id");
		expect(created).toHaveProperty("data");

		const got = await client.call("get", {
			service: marketplaceServiceId,
			resource: itemsResourceId,
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
			service: marketplaceServiceId,
			resource: itemsResourceId,
			archivedAt: null,
			status: "pending",
			data: { type: "pickup", time: "2026-06-03T10:00:00" },
		};

		const created = await client.call("create", {
			service: EVY_CORE_SERVICE,
			resource: EVY_CORE_RESOURCE.MESSAGES,
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
			resource: EVY_CORE_RESOURCE.MESSAGES,
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
			service: marketplaceServiceId,
			resource: itemsResourceId,
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
			service: marketplaceServiceId,
			resource: itemsResourceId,
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
