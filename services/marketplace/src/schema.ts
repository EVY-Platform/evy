// Client-free table definitions so scripts/seed.ts can share the exact
// same Data table shape without pulling in the marketplace's DB client.
import { jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import type { DATA_PRIMITIVE } from "evy-types";

export const data = pgTable("Data", {
	id: uuid("id").primaryKey().defaultRandom(),
	resource: varchar("resource", { length: 50 }).notNull(),
	data: jsonb("data").$type<DATA_PRIMITIVE["data"]>().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
