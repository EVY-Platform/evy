import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`Missing required database env: ${name}`);
	}
	return value;
}

export function getMarketplaceConnectionUrl(): string {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const database = requireEnv("DB_MARKETPLACE_DATABASE");

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}

const connectionString = getMarketplaceConnectionUrl();
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export { schema };
