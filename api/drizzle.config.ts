import { defineConfig } from "drizzle-kit";
import { getPostgresConnectionUrl } from "evy-types/env";

export default defineConfig({
	schema: "../types/generated/ts/db/schema.generated.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: getPostgresConnectionUrl("DB_EVY_DATABASE"),
	},
	verbose: true,
	strict: true,
});
