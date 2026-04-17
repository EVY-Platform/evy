import { defineConfig } from "drizzle-kit";
import { getMarketplaceConnectionUrl } from "./src/db";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: getMarketplaceConnectionUrl(),
	},
	verbose: true,
	strict: true,
});
