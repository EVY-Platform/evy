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
const { offServiceEvent, onServiceEvent } = await import("../events");

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
		).rejects.toThrow("Unsupported resource for marketplace service");
		await expect(
			upsert({
				service: "marketplace",
				resource: "sdui",
				data: { id: crypto.randomUUID(), name: "X", pages: [] },
			}),
		).rejects.toThrow("Unsupported resource for marketplace service");
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

	it("emits dataUpdated from the data layer when persisting catalog rows", async () => {
		const row = { id: crypto.randomUUID(), value: "Like new" };
		const received: { eventName: string; payload: unknown }[] = [];
		const listener = (eventName: string, payload: unknown) => {
			received.push({ eventName, payload });
		};
		onServiceEvent(listener);

		try {
			await upsert({
				service: "marketplace",
				resource: "conditions",
				data: row,
			});
		} finally {
			offServiceEvent(listener);
		}

		expect(received).toEqual([
			{
				eventName: "dataUpdated",
				payload: {
					service: "marketplace",
					resource: "conditions",
					value: row,
				},
			},
		]);
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

		expect(result).toEqual([secondRow]);
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
