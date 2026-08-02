import { desc, eq } from "drizzle-orm";

import { db, item_status_history } from "./db";
import { emitDataChanged } from "./events";
import { MARKETPLACE_RESOURCE } from "./resources";

export type ItemStatus = (typeof item_status_history.$inferSelect)["status"];

function monotonicCreatedAt(
	nowIso: string,
	latestCreatedAt: string | undefined,
): string {
	if (!latestCreatedAt || nowIso > latestCreatedAt) return nowIso;
	return new Date(new Date(latestCreatedAt).getTime() + 1).toISOString();
}

export async function currentStatus(itemId: string): Promise<ItemStatus> {
	const rows = await db
		.select({ status: item_status_history.status })
		.from(item_status_history)
		.where(eq(item_status_history.item_id, itemId))
		.orderBy(desc(item_status_history.created_at))
		.limit(1);

	return rows[0]?.status ?? "available";
}

export async function appendStatus(
	itemId: string,
	status: ItemStatus,
): Promise<void> {
	const latest = await db
		.select({ created_at: item_status_history.created_at })
		.from(item_status_history)
		.where(eq(item_status_history.item_id, itemId))
		.orderBy(desc(item_status_history.created_at))
		.limit(1);

	const created_at = monotonicCreatedAt(
		new Date().toISOString(),
		latest[0]?.created_at,
	);

	const inserted = await db
		.insert(item_status_history)
		.values({
			item_id: itemId,
			status,
			created_at,
		})
		.returning();

	// Status rows never pass through the data API, so this is the only place
	// that can tell subscribers the item moved.
	emitDataChanged(MARKETPLACE_RESOURCE.ITEM_STATUSES, "create", inserted[0]);
}
