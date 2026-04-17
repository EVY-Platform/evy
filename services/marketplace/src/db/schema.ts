import { jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import type { DATA_EVY_Data } from "evy-types";

export const data = pgTable("Data", {
	id: uuid("id").primaryKey().defaultRandom(),
	namespace: varchar("namespace", { length: 50 }).notNull(),
	resource: varchar("resource", { length: 50 }).notNull(),
	data: jsonb("data").$type<DATA_EVY_Data["data"]>().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
