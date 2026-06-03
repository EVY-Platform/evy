import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "../../../types/generated/ts/db/schema.generated";
import { getConnectionUrl } from "./connection";

export { getConnectionUrl };

function createDb() {
	const connectionString = getConnectionUrl();
	const client = new SQL(connectionString);
	return drizzle({ client, schema });
}

let dbInstance: ReturnType<typeof createDb> | undefined;

export function setDbForTest(database: ReturnType<typeof createDb>): void {
	dbInstance = database;
}

export function getDb(): ReturnType<typeof createDb> {
	dbInstance ??= createDb();
	return dbInstance;
}

export function hasDatabaseErrorCode(err: unknown, code: string): boolean {
	if (typeof err !== "object" || err === null) {
		return false;
	}

	if ("code" in err && err.code === code) {
		return true;
	}

	return "cause" in err && hasDatabaseErrorCode(err.cause, code);
}
