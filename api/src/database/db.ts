import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "../../../types/generated/ts/db/schema.generated";
import { getConnectionUrl } from "../data/connection";

export type EvyDb = ReturnType<typeof createDb>;

export const PG_UNIQUE_VIOLATION = "23505" as const;

export function createDb() {
	const connectionString = getConnectionUrl();
	const client = new SQL(connectionString);
	return drizzle({ client, schema });
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
