import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "../../../types/generated/ts/db/schema.generated";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required database env: ${name}`);
	}
	return value;
}

function getConnectionUrl(): string {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const database = requireEnv("DB_EVY_DATABASE");

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}

export type EvyDb = ReturnType<typeof createDb>;

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
