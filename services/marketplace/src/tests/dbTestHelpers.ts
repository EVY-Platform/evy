import { mock } from "bun:test";
import { createPgliteTestDatabase as createPgliteTestDatabaseWithSchema } from "evy-types/wsTestHelpers";

import { schema } from "../db";

export type PgliteTestDb = ReturnType<
	typeof createPgliteTestDatabase
>["testDb"];

export function createPgliteTestDatabase() {
	return createPgliteTestDatabaseWithSchema(schema);
}

/** Replaces `../db` with an in-memory PGlite instance for the importing test file. */
export function registerMarketplaceTestDb(testDb: PgliteTestDb): void {
	mock.module("../db", () => ({
		data: schema.data,
		item_status: schema.item_status,
		item_status_history: schema.item_status_history,
		db: testDb,
		schema,
	}));
}
