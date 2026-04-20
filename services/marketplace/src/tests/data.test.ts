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

const { get, upsert } = await import("../data");

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
});
