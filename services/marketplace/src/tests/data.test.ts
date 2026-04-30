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

function expectUnknownToEqual(actual: unknown, expected: unknown): void {
	expect(actual).toEqual(expected);
}

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
				resource: "conditions",
				data: oldRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: "conditions",
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

	it("uses filter.ids as primary key when inserting a new row (client id)", async () => {
		const clientId = crypto.randomUUID();
		const payload = { id: clientId, title: "client-keyed" };
		const inserted = await upsert({
			service: "marketplace",
			resource: "items",
			filter: { ids: [clientId] },
			data: payload,
		});
		expect(inserted.id).toBe(clientId);
		const byFilter = await get({
			service: "marketplace",
			resource: "items",
			filter: { ids: [clientId] },
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
			filter: { ids: [row.id] },
			data: { ...row, value: "v2" },
		});
		expect(updated.data).toEqual({ ...row, value: "v2" });
	});

	it("rejects upsert with multiple filter.ids", async () => {
		const row = { id: crypto.randomUUID(), value: "multi" };
		await expect(
			upsert({
				service: "marketplace",
				resource: "conditions",
				filter: { ids: [crypto.randomUUID(), crypto.randomUUID()] },
				data: row,
			}),
		).rejects.toThrow("Upsert filter.ids must contain at most one id");
	});

	it("returns item search results as ordered ids filtered by ids", async () => {
		const firstId = crypto.randomUUID();
		const secondId = crypto.randomUUID();
		const thirdId = crypto.randomUUID();
		await testDb.insert(schema.data).values([
			{
				id: firstId,
				resource: "items",
				data: { id: firstId, title: "First" },
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: secondId,
				resource: "items",
				data: { id: secondId, title: "Second" },
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
			{
				id: thirdId,
				resource: "items",
				data: { id: thirdId, title: "Third" },
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				ids: [thirdId, firstId],
			},
		});

		expectUnknownToEqual(result, [thirdId, firstId]);
	});

	it("returns item search results filtered by tagIds", async () => {
		const phoneId = crypto.randomUUID();
		const deskId = crypto.randomUUID();
		const laptopId = crypto.randomUUID();
		await testDb.insert(schema.data).values([
			{
				id: phoneId,
				resource: "items",
				data: {
					id: phoneId,
					title: "Phone",
					tags: [{ id: "electronics-tag", value: "Electronics" }],
				},
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: deskId,
				resource: "items",
				data: {
					id: deskId,
					title: "Desk",
					tags: [{ id: "furniture-tag", value: "Furniture" }],
				},
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
			{
				id: laptopId,
				resource: "items",
				data: {
					id: laptopId,
					title: "Laptop",
					tags: [{ id: "electronics-tag", value: "Electronics" }],
				},
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				tagIds: ["electronics-tag"],
			},
		});

		expectUnknownToEqual(result, [laptopId, phoneId]);
	});

	it("returns item search results matching both ids and tagIds", async () => {
		const matchingId = crypto.randomUUID();
		const excludedByTagId = crypto.randomUUID();
		const excludedByItemId = crypto.randomUUID();
		await testDb.insert(schema.data).values([
			{
				id: matchingId,
				resource: "items",
				data: {
					id: matchingId,
					title: "Matching",
					tags: [{ id: "wanted-tag", value: "Wanted" }],
				},
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: excludedByTagId,
				resource: "items",
				data: {
					id: excludedByTagId,
					title: "Wrong tag",
					tags: [{ id: "other-tag", value: "Other" }],
				},
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
			{
				id: excludedByItemId,
				resource: "items",
				data: {
					id: excludedByItemId,
					title: "Not requested",
					tags: [{ id: "wanted-tag", value: "Wanted" }],
				},
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				ids: [excludedByTagId, matchingId],
				tagIds: ["wanted-tag"],
			},
		});

		expectUnknownToEqual(result, [matchingId]);
	});

	it("applies limit and offset to item search results", async () => {
		const firstId = crypto.randomUUID();
		const secondId = crypto.randomUUID();
		const thirdId = crypto.randomUUID();
		await testDb.insert(schema.data).values([
			{
				id: firstId,
				resource: "items",
				data: { id: firstId, title: "First" },
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: secondId,
				resource: "items",
				data: { id: secondId, title: "Second" },
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
			{
				id: thirdId,
				resource: "items",
				data: { id: thirdId, title: "Third" },
				createdAt: "2024-01-03T00:00:00.000Z",
				updatedAt: "2024-01-03T00:00:00.000Z",
			},
		]);

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				limit: 1,
				offset: 1,
			},
		});

		expectUnknownToEqual(result, [secondId]);
	});

	it("returns no item search results when no items match", async () => {
		const itemId = crypto.randomUUID();
		await testDb.insert(schema.data).values({
			id: itemId,
			resource: "items",
			data: {
				id: itemId,
				title: "Phone",
				tags: [{ id: "phone-tag", value: "Phone" }],
			},
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		});

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				tagIds: ["missing-tag"],
			},
		});

		expect(result).toEqual([]);
	});

	it("returns the raw query and closest item tag suggestions", async () => {
		await testDb.insert(schema.data).values([
			{
				resource: "items",
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
				resource: "items",
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
				queryText: "iph",
			},
		});

		expect(result).toEqual([
			{ id: "query", value: "iph" },
			{ id: "iphone-tag", value: "iPhone" },
		]);
	});

	it("returns fuzzy suggestions when Levenshtein distance is at most three", async () => {
		await testDb.insert(schema.data).values({
			resource: "items",
			data: {
				id: crypto.randomUUID(),
				title: "Phone accessories",
				tags: [
					{ id: "near-phone-tag", value: "Phona" },
					{ id: "distance-three-tag", value: "Phxxx" },
					{ id: "distant-laptop-tag", value: "Laptop" },
				],
			},
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		});

		const result = await getForValidatedMarketplaceRequest({
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				queryText: "phone",
			},
		});

		expect(result).toEqual([
			{ id: "query", value: "phone" },
			{ id: "near-phone-tag", value: "Phona" },
			{ id: "distance-three-tag", value: "Phxxx" },
		]);
	});

	it("dedupes repeated item tags in suggestions", async () => {
		await testDb.insert(schema.data).values([
			{
				resource: "items",
				data: {
					id: crypto.randomUUID(),
					title: "First iPhone",
					tags: [{ id: "iphone-tag", value: "iPhone" }],
				},
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				resource: "items",
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
				queryText: "iphone",
			},
		});

		expect(result).toEqual([
			{ id: "query", value: "iphone" },
			{ id: "iphone-tag", value: "iPhone" },
		]);
	});

	it("returns no suggestions for an empty query", async () => {
		await testDb.insert(schema.data).values({
			resource: "items",
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
				queryText: "   ",
			},
		});

		expect(result).toEqual([]);
	});
});
