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
	it("rejects SDUI resource", async () => {
		await expect(
			get({
				namespace: "marketplace",
				resource: "sdui",
			}),
		).rejects.toThrow("SDUI is served by the api");
		await expect(
			upsert({
				namespace: "marketplace",
				resource: "sdui",
				data: { id: crypto.randomUUID(), name: "X", pages: [] },
			}),
		).rejects.toThrow("SDUI is served by the api");
	});

	it("persists catalog rows under namespace marketplace", async () => {
		const row = { id: crypto.randomUUID(), value: "Like new" };
		await upsert({
			namespace: "marketplace",
			resource: "conditions",
			data: row,
		});
		const result = await get({
			namespace: "marketplace",
			resource: "conditions",
		});
		expect(result).toEqual([row]);
	});
});
