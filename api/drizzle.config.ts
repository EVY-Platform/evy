import { defineConfig } from "drizzle-kit";
import { getConnectionUrl } from "./src/db/connectionUrl";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: getConnectionUrl(),
	},
	verbose: true,
	strict: true,
});
