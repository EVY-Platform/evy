import { jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import type { DATA_PRIMITIVE } from "evy-types";
import postgres from "postgres";

export const data = pgTable("Data", {
	id: uuid("id").primaryKey().defaultRandom(),
	resource: varchar("resource", { length: 50 }).notNull(),
	data: jsonb("data").$type<DATA_PRIMITIVE["data"]>().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export const schema = { data };

function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`Missing required database env: ${name}`);
	}
	return value;
}

export function getMarketplaceConnectionUrl(): string {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const database = requireEnv("DB_MARKETPLACE_DATABASE");

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}

function createMarketplaceDb() {
	const connectionString = getMarketplaceConnectionUrl();
	const client = postgres(connectionString);
	return drizzle(client, { schema });
}

let dbInstance: ReturnType<typeof createMarketplaceDb> | undefined;

function getDb(): ReturnType<typeof createMarketplaceDb> {
	dbInstance ??= createMarketplaceDb();
	return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof createMarketplaceDb>, {
	get(_target, property) {
		const instance = getDb();
		const value = Reflect.get(instance, property, instance);
		return typeof value === "function" ? value.bind(instance) : value;
	},
});
