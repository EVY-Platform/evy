import { desc, eq } from "drizzle-orm";
import { nowIso as clockNowIso } from "evy-types/clock";

import { db, item_status_history } from "./db";
import { emitDataChanged } from "./events";
import { MARKETPLACE_RESOURCE } from "./resources";

export type ItemStatus = (typeof item_status_history.$inferSelect)["status"];

async function latestStatusRow(itemId: string) {
	return db
		.select({
			status: item_status_history.status,
			created_at: item_status_history.created_at,
		})
		.from(item_status_history)
		.where(eq(item_status_history.item_id, itemId))
		.orderBy(desc(item_status_history.created_at))
		.limit(1);
}

export async function currentStatus(itemId: string): Promise<ItemStatus> {
	const rows = await latestStatusRow(itemId);
	return rows[0]?.status ?? "available";
}

export async function appendStatus(
	itemId: string,
	status: ItemStatus,
): Promise<void> {
	const created_at = clockNowIso();

	const inserted = await db
		.insert(item_status_history)
		.values({
			item_id: itemId,
			status,
			created_at,
		})
		.returning();

	// Status writes bypass the data API; reads go through get.
	emitDataChanged(MARKETPLACE_RESOURCE.ITEM_STATUSES, "create", inserted[0]);
}
