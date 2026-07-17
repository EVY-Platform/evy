import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "../db";
import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "../resources";
import {
	createPgliteTestDatabase,
	registerMarketplaceTestDb,
} from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

registerMarketplaceTestDb(testDb);

const { create, deleteResource, get, update } = await import("../data");

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

describe("marketplace get/create/update", () => {
	it("rejects unsupported resources", async () => {
		await expect(
			get({
				service: MARKETPLACE_SERVICE,
				resource: "unsupported-resource",
			}),
		).rejects.toThrow("Unsupported resource id for marketplace service");
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: "unsupported-resource",
				data: { id: crypto.randomUUID(), name: "X" },
			}),
		).rejects.toThrow("Unsupported resource id for marketplace service");
	});

	it("persists resource rows for service marketplace", async () => {
		const row = { id: crypto.randomUUID(), value: "Like new" };
		await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});
		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});
		expect(result).toHaveLength(1);
		expect(result).toEqual([row]);
	});

	it("returns rows ordered by oldest first", async () => {
		const olderRow = { id: crypto.randomUUID(), value: "older" };
		const newerRow = { id: crypto.randomUUID(), value: "newer" };

		await testDb.insert(schema.data).values([
			{
				id: olderRow.id,
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: olderRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: newerRow.id,
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: newerRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});

		expect(result).toEqual([olderRow, newerRow]);
	});

	it("filters rows by updatedAfter", async () => {
		const oldRow = { id: crypto.randomUUID(), value: "old" };
		const newRow = { id: crypto.randomUUID(), value: "new" };

		await testDb.insert(schema.data).values([
			{
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: oldRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: newRow,
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { updatedAfter: "2024-01-02T00:00:00.000Z" },
		});

		expect(result).toHaveLength(1);
		expect(result).toEqual([newRow]);
	});

	it("filters rows by id", async () => {
		const firstId = crypto.randomUUID();
		const secondId = crypto.randomUUID();
		const firstRow = { id: firstId, title: "First" };
		const secondRow = { id: secondId, title: "Second" };
		await testDb.insert(schema.data).values([
			{
				id: firstId,
				resource: MARKETPLACE_RESOURCE.ITEMS,
				data: firstRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: secondId,
				resource: MARKETPLACE_RESOURCE.ITEMS,
				data: secondRow,
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: secondId },
		});

		expect(result).toHaveLength(1);
		expect(result).toEqual([secondRow]);
	});

	it("uses filter.id as primary key when inserting a new row (client id)", async () => {
		const clientId = crypto.randomUUID();
		const payload = { id: clientId, title: "client-keyed" };
		const inserted = await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: clientId },
			data: payload,
		});
		expect(inserted.id).toBe(clientId);
		const byFilter = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: clientId },
		});
		expect(byFilter).toEqual([payload]);
	});

	it("create then update row", async () => {
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "v1" };
		await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: row,
		});
		const updated = await update({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: { ...row, value: "v2" },
		});
		expect(updated).toMatchObject({ data: { ...row, value: "v2" } });
	});

	it("validates marketplace request payloads on create and update", async () => {
		const itemId = crypto.randomUUID();
		const pickupRequest = {
			id: crypto.randomUUID(),
			type: "pickup" as const,
			item_id: itemId,
			time: "2026-06-03T10:00:00",
			archived: false,
		};
		const deliveryRequest = {
			id: crypto.randomUUID(),
			type: "delivery" as const,
			item_id: itemId,
			time: "2026-06-03T11:00:00",
			archived: false,
		};
		const shippingRequest = {
			id: crypto.randomUUID(),
			type: "shipping" as const,
			item_id: itemId,
			postalcode: "2018",
			archived: false,
		};

		for (const request of [
			pickupRequest,
			deliveryRequest,
			shippingRequest,
		]) {
			await create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.REQUESTS,
				filter: { id: request.id },
				data: request,
			});
		}

		const requests = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.REQUESTS,
		});
		expect(requests).toHaveLength(3);
		expect(requests).toEqual(
			expect.arrayContaining([
				pickupRequest,
				deliveryRequest,
				shippingRequest,
			]),
		);

		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.REQUESTS,
				data: {
					id: crypto.randomUUID(),
					type: "pickup",
					item_id: itemId,
				},
			}),
		).rejects.toThrow("Marketplace request validation failed");
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.REQUESTS,
				data: {
					id: crypto.randomUUID(),
					type: "shipping",
					item_id: itemId,
					time: "2026-06-03T10:00:00",
				},
			}),
		).rejects.toThrow("Marketplace request validation failed");
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.REQUESTS,
				data: {
					id: crypto.randomUUID(),
					type: "collection",
					item_id: itemId,
				},
			}),
		).rejects.toThrow("Marketplace request validation failed");
		await expect(
			create({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.REQUESTS,
				data: {
					id: crypto.randomUUID(),
					type: "pickup",
					item_id: itemId,
					time: "2026-06-03",
				},
			}),
		).rejects.toThrow("Marketplace request validation failed");
		await expect(
			update({
				service: MARKETPLACE_SERVICE,
				resource: MARKETPLACE_RESOURCE.REQUESTS,
				filter: { id: pickupRequest.id },
				data: { ...pickupRequest, time: "2026-06-03" },
			}),
		).rejects.toThrow("Marketplace request validation failed");

		const archivedPickup = { ...pickupRequest, archived: true };
		const updated = await update({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.REQUESTS,
			filter: { id: pickupRequest.id },
			data: archivedPickup,
		});
		expect(updated).toMatchObject({ data: archivedPickup });
	});

	it("deletes a row by resource and id", async () => {
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "delete-me" };
		await create({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: row,
		});

		const deleted = await deleteResource({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
		});
		expect(deleted).toMatchObject({ id: rowId, data: row });

		const remaining = await get({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
		});
		expect(remaining).toEqual([]);
	});
});
