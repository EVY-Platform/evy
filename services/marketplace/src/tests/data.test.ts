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
import { schema } from "../db";
import { createPgliteTestDatabase } from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	data: schema.data,
	db: testDb,
	schema,
}));

const { create, get, update } = await import("../data");

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
	it("rejects SDUI resource (not a valid marketplace RPC pair)", async () => {
		await expect(
			get({
				service: "marketplace",
				resource: "sdui",
			}),
		).rejects.toThrow("Unsupported resource for marketplace service");
		await expect(
			create({
				service: "marketplace",
				resource: "sdui",
				data: { id: crypto.randomUUID(), name: "X", pages: [] },
			}),
		).rejects.toThrow("Unsupported resource for marketplace service");
	});

	it("persists resource rows for service marketplace", async () => {
		const row = { id: crypto.randomUUID(), value: "Like new" };
		await create({
			service: "marketplace",
			resource: "conditions",
			data: row,
		});
		const result = await get({
			service: "marketplace",
			resource: "conditions",
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
				resource: "conditions",
				data: olderRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: newerRow.id,
				resource: "conditions",
				data: newerRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: "marketplace",
			resource: "conditions",
		});

		expect(result).toEqual([olderRow, newerRow]);
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
				resource: "items",
				data: firstRow,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			},
			{
				id: secondId,
				resource: "items",
				data: secondRow,
				createdAt: "2024-01-02T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		]);

		const result = await get({
			service: "marketplace",
			resource: "items",
			filter: { id: secondId },
		});

		expect(result).toHaveLength(1);
		expect(result).toEqual([secondRow]);
	});

	it("uses filter.id as primary key when inserting a new row (client id)", async () => {
		const clientId = crypto.randomUUID();
		const payload = { id: clientId, title: "client-keyed" };
		const inserted = await create({
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

	it("create then update row", async () => {
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "v1" };
		await create({
			service: "marketplace",
			resource: "conditions",
			filter: { id: rowId },
			data: row,
		});
		const updated = await update({
			service: "marketplace",
			resource: "conditions",
			filter: { id: rowId },
			data: { ...row, value: "v2" },
		});
		expect(updated.data).toEqual({ ...row, value: "v2" });
	});
});
