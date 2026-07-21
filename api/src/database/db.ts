import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "evy-types/db/schema.generated";
import { getPostgresConnectionUrl } from "evy-types/env";

export type EvyDb = ReturnType<typeof createDb>;

export function createDb() {
	const connectionString = getPostgresConnectionUrl("DB_EVY_DATABASE");
	const client = new SQL(connectionString);
	return drizzle({ client, schema });
}
