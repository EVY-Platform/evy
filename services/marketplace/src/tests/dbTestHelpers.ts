import { PGlite } from "@electric-sql/pglite";
import { fuzzystrmatch } from "@electric-sql/pglite/contrib/fuzzystrmatch";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

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
