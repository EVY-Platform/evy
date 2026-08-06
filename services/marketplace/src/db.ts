import { drizzle } from "drizzle-orm/postgres-js";
import { getPostgresConnectionUrl } from "evy-types/env";
import postgres from "postgres";
import {
	data,
	item_payment_intents,
	item_status,
	item_status_history,
} from "./schema";

export { data, item_payment_intents, item_status, item_status_history };

// exported for tests
export const schema = {
	data,
	item_payment_intents,
	item_status,
	item_status_history,
};

export function getMarketplaceConnectionUrl(): string {
	return getPostgresConnectionUrl("DB_MARKETPLACE_DATABASE");
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
