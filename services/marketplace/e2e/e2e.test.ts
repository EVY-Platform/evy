import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { waitForClientOpen } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import { discoverMarketplaceIds } from "../src/tests/discoverMarketplaceIds";

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

/**
 * A rejected JSON-RPC call arrives as `{code, message, data}`, where `message`
 * is the error's class name and `data` carries what actually went wrong.
 */
function failureDetail(failure: unknown): string {
	if (!isRecord(failure)) return String(failure);
	return [failure.message, failure.data]
		.filter((part): part is string => typeof part === "string")
		.join(": ");
}

describe("Marketplace E2E (via API WebSocket)", () => {
	let client: WSClient;
	let marketplaceServiceId: string;
	let itemsResourceId: string;

	beforeAll(async () => {
		client = new Client(API_URL);
		await waitForClientOpen(client, CONNECTION_TIMEOUT_MS);
		await client.login({ token: TEST_TOKEN, os: TEST_OS });

		const response = await client.call("resources", {});
		const discovered = discoverMarketplaceIds(response, ["items"]);
		marketplaceServiceId = discovered.serviceId;
		itemsResourceId = discovered.resourceIds.items;
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

	// The gateway forwards item payloads without inspecting them, so these
	// rejections prove the marketplace service is the one checking — and that
	// the reason survives the hop back, since it is all the caller gets.
	it("rejects an item whose known field has the wrong type", async () => {
		const failure = await client
			.call("create", {
				service: marketplaceServiceId,
				resource: itemsResourceId,
				data: { id: crypto.randomUUID(), title: 123 },
			})
			.catch((error: unknown) => error);

		expect(failureDetail(failure)).toContain("/title: must be string");
	});

	it("rejects a lookup row with an unknown key", async () => {
		const response = await client.call("resources", {});
		const { resourceIds } = discoverMarketplaceIds(response, [
			"conditions",
		]);

		const failure = await client
			.call("create", {
				service: marketplaceServiceId,
				resource: resourceIds.conditions,
				data: { id: crypto.randomUUID(), value: "Mint", extra: true },
			})
			.catch((error: unknown) => error);

		expect(failureDetail(failure)).toContain(
			"must NOT have additional propert",
		);
	});

	// The builder reads these off the catalog the gateway aggregates, so they
	// have to survive both the service hop and the api hop.
	it("exposes marketplace attributes through the API resource catalog", async () => {
		const response = (await client.call("resources", {})) as {
			services: {
				id: string;
				resources: { name: string; attributes?: string[] }[];
			}[];
		};
		const marketplace = response.services.find(
			(service) => service.id === marketplaceServiceId,
		);
		const items = marketplace?.resources.find(
			(resource) => resource.name === "items",
		);

		expect(items?.attributes).toContain("title");
		expect(items?.attributes).toContain("price.currency");
		expect(items?.attributes).toContain(
			"transfer_options.pickup.address_id",
		);
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
