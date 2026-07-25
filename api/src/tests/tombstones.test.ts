import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "evy-types/db/schema.generated";
import {
	isCursorExpired,
	purgeTombstones,
	tombstoneHorizon,
	tombstoneRetentionDays,
} from "../data/tombstones";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const NOW = new Date("2026-07-25T00:00:00.000Z");
const DAY_MS = 86_400_000;

function daysBefore(days: number): string {
	return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

async function insertMessage(id: string, deletedAt: string | null) {
	await testDb.insert(schema.message).values({
		id,
		fk: crypto.randomUUID(),
		service: crypto.randomUUID(),
		resource: crypto.randomUUID(),
		status: "pending",
		data: {},
		createdAt: daysBefore(100),
		updatedAt: daysBefore(100),
		deletedAt,
	});
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
	delete process.env.TOMBSTONE_RETENTION_DAYS;
});

describe("tombstone retention window", () => {
	it("defaults to 30 days", () => {
		expect(tombstoneRetentionDays()).toBe(30);
	});

	it("honours a configured window", () => {
		process.env.TOMBSTONE_RETENTION_DAYS = "7";
		expect(tombstoneRetentionDays()).toBe(7);
		expect(tombstoneHorizon(NOW)).toBe(daysBefore(7));
	});

	it("ignores a nonsense window rather than purging everything", () => {
		process.env.TOMBSTONE_RETENTION_DAYS = "0";
		expect(tombstoneRetentionDays()).toBe(30);
		process.env.TOMBSTONE_RETENTION_DAYS = "not-a-number";
		expect(tombstoneRetentionDays()).toBe(30);
	});
});

describe("cursor expiry", () => {
	it("treats a cursor older than the horizon as expired", () => {
		expect(isCursorExpired(daysBefore(31), tombstoneHorizon(NOW))).toBe(
			true,
		);
	});

	it("accepts a cursor inside the window", () => {
		expect(isCursorExpired(daysBefore(29), tombstoneHorizon(NOW))).toBe(
			false,
		);
	});

	it("does not call an absent cursor expired", () => {
		// No cursor is already a full sync; calling it expired would be noise.
		expect(isCursorExpired(undefined, tombstoneHorizon(NOW))).toBe(false);
	});
});

describe("purge", () => {
	it("removes tombstones past the window and keeps the rest", async () => {
		await insertMessage(crypto.randomUUID(), daysBefore(31));
		const recentlyDeleted = crypto.randomUUID();
		await insertMessage(recentlyDeleted, daysBefore(29));
		const live = crypto.randomUUID();
		await insertMessage(live, null);

		const result = await purgeTombstones(dataDb, NOW);

		expect(result.total).toBe(1);
		expect(result.purged.Message).toBe(1);

		const remaining = await testDb.select().from(schema.message);
		expect(remaining.map((r) => r.id).sort()).toEqual(
			[recentlyDeleted, live].sort(),
		);
	});

	it("never removes a live row", async () => {
		const live = crypto.randomUUID();
		await insertMessage(live, null);

		await purgeTombstones(dataDb, NOW);

		const rows = await testDb
			.select()
			.from(schema.message)
			.where(eq(schema.message.id, live));
		expect(rows).toHaveLength(1);
	});

	it("is safe to run when there is nothing to purge", async () => {
		const result = await purgeTombstones(dataDb, NOW);
		expect(result.total).toBe(0);
		expect(result.purged).toEqual({});
	});
});
