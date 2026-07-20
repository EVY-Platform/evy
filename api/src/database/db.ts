import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { getPostgresConnectionUrl } from "evy-types/env";

import * as schema from "../../../types/generated/ts/db/schema.generated";

export type EvyDb = ReturnType<typeof createDb>;

export function createDb() {
	const connectionString = getPostgresConnectionUrl("DB_EVY_DATABASE");
	const client = new SQL(connectionString);
	return drizzle({ client, schema });
}
