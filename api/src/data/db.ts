import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "../../../types/generated/ts/db/schema.generated";

export function getConnectionUrl(): string {
	const user = process.env.DB_USER;
	const pass = process.env.DB_PASS;
	const port = process.env.DB_PORT;
	const domain = process.env.DB_DOMAIN;
	const database = process.env.DB_EVY_DATABASE;

	if (!user || !pass || !port || !domain || !database) {
		const missing = [
			!user && "DB_USER",
			!pass && "DB_PASS",
			!port && "DB_PORT",
			!domain && "DB_DOMAIN",
			!database && "DB_EVY_DATABASE",
		]
			.filter(Boolean)
			.join(", ");
		throw new Error(`Missing required database env: ${missing}`);
	}

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}

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
