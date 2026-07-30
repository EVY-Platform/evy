// Client-free table definitions so scripts/seed.ts can share the exact
// same Data table shape without pulling in the marketplace's DB client.
import { jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import type { DATA_PRIMITIVE } from "evy-types";

export const data = pgTable("data", {
	id: uuid("id").primaryKey().defaultRandom(),
	resource: varchar("resource", { length: 50 }).notNull(),
	data: jsonb("data").$type<DATA_PRIMITIVE["data"]>().notNull(),
	created_at: text("created_at").notNull(),
	updated_at: text("updated_at").notNull(),
	// Tombstone: kept so incremental reads can tell clients the row is gone.
	deleted_at: text("deleted_at"),
});
