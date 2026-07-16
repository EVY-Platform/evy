import { mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { fuzzystrmatch } from "@electric-sql/pglite/contrib/fuzzystrmatch";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { schema } from "../db";

export type PgliteTestDb = PgliteDatabase<typeof schema>;

export function createPgliteTestDatabase(): {
	pgliteClient: PGlite;
	testDb: PgliteTestDb;
} {
	const pgliteClient = new PGlite({ extensions: { fuzzystrmatch } });
	const testDb = drizzle(pgliteClient, { schema });
	return { pgliteClient, testDb };
}

/** Replaces `../db` with an in-memory PGlite instance for the importing test file. */
export function registerMarketplaceTestDb(testDb: PgliteTestDb): void {
	mock.module("../db", () => ({
		data: schema.data,
		db: testDb,
		schema,
	}));
}
