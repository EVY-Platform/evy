import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

import { db, schema } from "../db";
import { DATA_CHANGED_EVENT, onServiceEvent } from "../events";
import { MARKETPLACE_RESOURCE } from "../resources";
import { appendStatus, currentStatus } from "../status";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
});

const itemId = "00000000-0000-4000-8000-000000000001";

beforeEach(async () => {
	await db.delete(schema.item_status_history);
});

describe("currentStatus", () => {
	it("returns available when history is empty", async () => {
		expect(await currentStatus(itemId)).toBe("available");
	});

	it("returns the latest status row", async () => {
		await db.insert(schema.item_status_history).values([
			{
				item_id: itemId,
				status: "pickup_pending",
				created_at: "2024-01-01T00:00:00.000Z",
			},
			{
				item_id: itemId,
				status: "sold",
				created_at: "2024-01-02T00:00:00.000Z",
			},
		]);

		expect(await currentStatus(itemId)).toBe("sold");
	});
});

describe("appendStatus", () => {
	it("inserts a new status row without updating existing rows", async () => {
		await appendStatus(itemId, "pickup_pending");
		await appendStatus(itemId, "sold");

		const rows = await db
			.select()
			.from(schema.item_status_history)
			.where(eq(schema.item_status_history.item_id, itemId));

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.status)).toEqual([
			"pickup_pending",
			"sold",
		]);
	});

	// Status rows bypass the data API, so this notification is the only way
	// subscribers learn an item moved.
	it("notifies subscribers with the inserted row", async () => {
		const events: { name: string; payload: unknown }[] = [];
		onServiceEvent((name, payload) => events.push({ name, payload }));

		await appendStatus(itemId, "sold");

		expect(events).toHaveLength(1);
		expect(events[0].name).toBe(DATA_CHANGED_EVENT);
		expect(events[0].payload).toMatchObject({
			resource: MARKETPLACE_RESOURCE.ITEM_STATUSES,
			operation: "create",
			value: { item_id: itemId, status: "sold" },
		});
	});
});
