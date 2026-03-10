import { defineConfig } from "drizzle-kit";
import { getConnectionUrl } from "./src/db/connectionUrl";

export default defineConfig({
	schema: "../types/generated/ts/db/schema.generated.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: getConnectionUrl(),
	},
	verbose: true,
	strict: true,
});
