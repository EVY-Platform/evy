import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";
import { createPgliteTestDatabase } from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	db: testDb,
	schema,
}));

const { get, getForValidatedMarketplaceRequest, upsert } = await import(
	"../data"
);

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

describe("marketplace get/upsert", () => {
	it("rejects SDUI resource (not a valid marketplace RPC pair)", async () => {
		await expect(
			get({
				service: "marketplace",
				resource: "sdui",
			}),
		).rejects.toThrow("Invalid service and resource combination");
		await expect(
			upsert({
				service: "marketplace",
				resource: "sdui",
				data: { id: crypto.randomUUID(), name: "X", pages: [] },
			}),
		).rejects.toThrow("Invalid service and resource combination");
	});

	it("persists catalog rows for service marketplace", async () => {
		const row = { id: crypto.randomUUID(), value: "Like new" };
		await upsert({
			service: "marketplace",
			resource: "conditions",
			data: row,
		});
		const result = await get({
			service: "marketplace",
			resource: "conditions",
		});
		expect(result).toEqual([row]);
	});

	it("filters rows by updatedAfter", async () => {
		const oldRow = { id: crypto.randomUUID(), value: "old" };
		const newRow = { id: crypto.randomUUID(), value: "new" };

		await testDb.insert(schema.data).values([
			{
				resource: "condition",
				data: oldRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: "condition",
				data: newRow,
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: "marketplace",
			resource: "conditions",
			filter: { updatedAfter: "2024-01-02T00:00:00.000Z" },
		});

		expect(result).toEqual([newRow]);
	});

	it("uses filter.id as primary key when inserting a new row (client id)", async () => {
		const clientId = crypto.randomUUID();
		const payload = { id: clientId, title: "client-keyed" };
		const inserted = await upsert({
			service: "marketplace",
			resource: "items",
			filter: { id: clientId },
			data: payload,
		});
		expect(inserted.id).toBe(clientId);
		const byFilter = await get({
			service: "marketplace",
			resource: "items",
			filter: { id: clientId },
		});
		expect(byFilter).toEqual([payload]);
	});

	it("upsert update path returns a row that validates as UpsertResponse", async () => {
		const row = { id: crypto.randomUUID(), value: "v1" };
		await upsert({
			service: "marketplace",
			resource: "conditions",
			data: row,
		});
		const updated = await upsert({
			service: "marketplace",
			resource: "conditions",
			filter: { id: row.id },
			data: { ...row, value: "v2" },
		});
		expect(updated.data).toEqual({ ...row, value: "v2" });
	});

	it("returns the raw query and closest item tag suggestions", async () => {
		await testDb.insert(schema.data).values([
			{
				resource: "item",
				data: {
					id: crypto.randomUUID(),
					title: "iPhone 13",
					tags: [
						{ id: "iphone-tag", value: "iPhone" },
						{ id: "apple-tag", value: "Apple" },
					],
				},
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: "item",
				data: {
					id: crypto.randomUUID(),
					title: "Desk phone",
					tags: [
						{ id: "phone-tag", value: "Phone" },
						{ id: "office-tag", value: "Office" },
					],
				},
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				query: "iph",
			},
		});

		expect(result[0]).toEqual({ id: "query", value: "iph" });
		expect(result.slice(1, 4)).toContainEqual({
			id: "iphone-tag",
			value: "iPhone",
		});
		expect(result).toHaveLength(4);
	});

	it("dedupes repeated item tags in suggestions", async () => {
		await testDb.insert(schema.data).values([
			{
				resource: "item",
				data: {
					id: crypto.randomUUID(),
					title: "First iPhone",
					tags: [{ id: "iphone-tag", value: "iPhone" }],
				},
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: "item",
				data: {
					id: crypto.randomUUID(),
					title: "Second iPhone",
					tags: [{ id: "iphone-tag", value: "iPhone" }],
				},
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				query: "iphone",
			},
		});

		expect(result).toEqual([
			{ id: "query", value: "iphone" },
			{ id: "iphone-tag", value: "iPhone" },
		]);
	});

	it("returns no suggestions for an empty query", async () => {
		await testDb.insert(schema.data).values({
			resource: "item",
			data: {
				id: crypto.randomUUID(),
				title: "iPhone 13",
				tags: [{ id: "iphone-tag", value: "iPhone" }],
			},
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		});

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				query: "   ",
			},
		});

		expect(result).toEqual([]);
	});
});
