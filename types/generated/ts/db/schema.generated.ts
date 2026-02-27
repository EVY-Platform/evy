/* eslint-disable */
/** Generated from types/schema/data - do not edit. */

import {
	pgTable,
	pgEnum,
	uuid,
	varchar,
	text,
	timestamp,
	boolean,
	jsonb,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { SDUI_Flow } from "evy-types/sdui/evy";
import type { DATA_Data } from "evy-types/data/data";

export const osEnum = pgEnum("OS", ["ios", "android", "Web"]);

export const device = pgTable(
	"Device",
	{
		token: varchar("token", { length: 256 }).primaryKey().notNull(),
		os: osEnum("os").notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
	},
	(table) => [
		uniqueIndex("Device_token_os_key").on(table.token, table.os),
	],
);

export const service = pgTable(
	"Service",
	{
		id: uuid("id").primaryKey().notNull(),
		name: varchar("name", { length: 50 }).notNull(),
		description: text("description").notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
	(table) => [
		uniqueIndex("Service_name_key").on(table.name),
	],
);

export const organization = pgTable(
	"Organization",
	{
		id: uuid("id").primaryKey().notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description").notNull(),
		logo: uuid("logo").notNull(),
		url: varchar("url", { length: 50 }).notNull(),
		supportEmail: varchar("support_email", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
	(table) => [
		uniqueIndex("Organization_name_key").on(table.name),
	],
);

export const serviceProvider = pgTable(
	"ServiceProvider",
	{
		id: uuid("id").primaryKey().notNull(),
		fkServiceId: uuid("fk_service_id").notNull(),
		fkOrganizationId: uuid("fk_organization_id").notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description").notNull(),
		logo: uuid("logo").notNull(),
		url: varchar("url", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		retired: boolean("retired").notNull().default(false),
	},
	(table) => [
		uniqueIndex("ServiceProvider_name_key").on(table.name),
		uniqueIndex("ServiceProvider_fk_service_id_fk_organization_id_key").on(table.fkServiceId, table.fkOrganizationId),
	],
);

export const flow = pgTable(
	"Flow",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		data: jsonb("data").$type<SDUI_Flow>().notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
);

export const data = pgTable(
	"Data",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		data: jsonb("data").$type<DATA_Data["data"]>().notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
);

export const serviceRelations = relations(service, ({ many }) => ({
	providers: many(serviceProvider),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
	providers: many(serviceProvider),
}));

export const serviceProviderRelations = relations(
	serviceProvider,
	({ one }) => ({
		service: one(service, {
			fields: [serviceProvider.fkServiceId],
			references: [service.id],
		}),
		organization: one(organization, {
			fields: [serviceProvider.fkOrganizationId],
			references: [organization.id],
		}),
	}),
);
