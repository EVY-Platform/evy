import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "../db/schema";

export type PgliteTestDb = PgliteDatabase<typeof schema>;

export function createPgliteTestDatabase(): {
	pgliteClient: PGlite;
	testDb: PgliteTestDb;
} {
	const pgliteClient = new PGlite();
	const testDb = drizzle(pgliteClient, { schema });
	return { pgliteClient, testDb };
}

export async function clearAllTestTables(testDb: PgliteTestDb): Promise<void> {
	await testDb.delete(schema.data);
}
