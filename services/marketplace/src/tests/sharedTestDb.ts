import { afterAll, mock } from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createPgliteTestDatabase as createPgliteTestDatabaseWithSchema } from "evy-types/wsTestHelpers";

import { schema } from "../db";

function createPgliteTestDatabase() {
	return createPgliteTestDatabaseWithSchema(schema);
}

const database = createPgliteTestDatabase();

function registerMarketplaceTestDb(
	testDb: ReturnType<typeof createPgliteTestDatabase>["testDb"],
): void {
	mock.module("../db", () => ({
		data: schema.data,
		item_payment_intents: schema.item_payment_intents,
		item_status: schema.item_status,
		item_status_history: schema.item_status_history,
		db: testDb,
		schema,
	}));
}

registerMarketplaceTestDb(database.testDb);

let migrated = false;

export async function ensureMarketplaceTestSchema(): Promise<void> {
	if (migrated) return;
	await migrate(database.testDb, { migrationsFolder: "./drizzle" });
	migrated = true;
}

// This client is a singleton shared by every test file in the process, so it
// outlives any one file. Closing it here (once, after everything finishes)
// prevents PGlite's WASM instance from being left open, which otherwise
// keeps the process from exiting cleanly.
afterAll(async () => {
	await database.pgliteClient.close();
});
