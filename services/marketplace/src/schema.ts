// Client-free table definitions so scripts/seed.ts can share the exact
// same Data table shape without pulling in the marketplace's DB client.
import {
	jsonb,
	pgEnum,
	pgTable,
	text,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
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

export const item_status = pgEnum("item_status", [
	"available",
	"pickup_pending",
	"delivery_pending",
	"shipping_pending",
	"sold",
]);

export const item_status_history = pgTable("item_status_history", {
	id: uuid("id").primaryKey().defaultRandom(),
	item_id: uuid("item_id").notNull(),
	status: item_status("status").notNull(),
	created_at: text("created_at").notNull(),
});

export const item_payment_intents = pgTable("item_payment_intents", {
	id: uuid("id").primaryKey().defaultRandom(),
	item_id: uuid("item_id").notNull(),
	authorization_message_id: uuid("authorization_message_id").notNull(),
	payment_intent_id: text("payment_intent_id").notNull(),
	created_at: text("created_at").notNull(),
});
