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
	primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { ValidatedFlowData } from "../validation";

export const osEnum = pgEnum("OS", ["ios", "android", "Web"]);

export const device = pgTable(
	"Device",
	{
		token: varchar("token", { length: 256 }).primaryKey(),
		os: osEnum("os").notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
	},
	(table) => [uniqueIndex("Device_token_os_key").on(table.token, table.os)],
);

export const service = pgTable(
	"Service",
	{
		id: uuid("id").primaryKey(),
		name: varchar("name", { length: 50 }).notNull().unique(),
		description: text("description").notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
	(table) => [uniqueIndex("Service_name_key").on(table.name)],
);

export const serviceRelations = relations(service, ({ many }) => ({
	providers: many(serviceProvider),
}));

export const organization = pgTable(
	"Organization",
	{
		id: uuid("id").primaryKey(),
		name: varchar("name", { length: 100 }).notNull().unique(),
		description: text("description").notNull(),
		logo: uuid("logo").notNull(),
		url: varchar("url", { length: 50 }).notNull(),
		supportEmail: varchar("support_email", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
	(table) => [uniqueIndex("Organization_name_key").on(table.name)],
);

export const organizationRelations = relations(organization, ({ many }) => ({
	providers: many(serviceProvider),
}));

export const serviceProvider = pgTable(
	"ServiceProvider",
	{
		id: uuid("id").primaryKey(),
		fkServiceId: uuid("fk_service_id").notNull(),
		fkOrganizationId: uuid("fk_organization_id").notNull(),
		name: varchar("name", { length: 100 }).notNull().unique(),
		description: text("description").notNull(),
		logo: uuid("logo").notNull(),
		url: varchar("url", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		retired: boolean("retired").notNull().default(false),
	},
	(table) => [
		uniqueIndex("ServiceProvider_name_key").on(table.name),
		uniqueIndex("ServiceProvider_fk_service_id_fk_organization_id_key").on(
			table.fkServiceId,
			table.fkOrganizationId,
		),
	],
);

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

export const flow = pgTable("Flow", {
	id: uuid("id").primaryKey().defaultRandom(),
	data: jsonb("data").$type<ValidatedFlowData>().notNull(),
	createdAt: timestamp("created_at", { precision: 3 }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export type ServiceData = Record<string, unknown>;

export const data = pgTable("Data", {
	id: uuid("id").primaryKey().defaultRandom(),
	data: jsonb("data").$type<ServiceData>().notNull(),
	createdAt: timestamp("created_at", { precision: 3 }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export type Device = typeof device.$inferSelect;
export type NewDevice = typeof device.$inferInsert;
export type Service = typeof service.$inferSelect;
export type NewService = typeof service.$inferInsert;
export type Organization = typeof organization.$inferSelect;
export type NewOrganization = typeof organization.$inferInsert;
export type ServiceProvider = typeof serviceProvider.$inferSelect;
export type NewServiceProvider = typeof serviceProvider.$inferInsert;
export type Flow = typeof flow.$inferSelect;
export type NewFlow = typeof flow.$inferInsert;
export type Data = typeof data.$inferSelect;
export type NewData = typeof data.$inferInsert;

export type OS = (typeof osEnum.enumValues)[number];
