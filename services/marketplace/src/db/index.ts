import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getMarketplaceConnectionUrl } from "./connectionUrl";

const connectionString = getMarketplaceConnectionUrl();
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export { schema };
