import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DB_URL;

if (!connectionString) {
	throw new Error("DB_URL environment variable is not set");
}

// Create postgres client
const client = postgres(connectionString);

// Create drizzle database instance with schema
export const db = drizzle(client, { schema, logger: true });

// Re-export schema for convenience
export * from "./schema";
