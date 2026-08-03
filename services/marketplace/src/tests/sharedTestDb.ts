import { migrate } from "drizzle-orm/pglite/migrator";

import {
	createPgliteTestDatabase,
	registerMarketplaceTestDb,
} from "./dbTestHelpers";

const database = createPgliteTestDatabase();

registerMarketplaceTestDb(database.testDb);

let migrated = false;

export async function ensureMarketplaceTestSchema(): Promise<void> {
	if (migrated) return;
	await migrate(database.testDb, { migrationsFolder: "./drizzle" });
	migrated = true;
}

export const marketplaceTestPglite = database.pgliteClient;
export const marketplaceTestDb = database.testDb;
