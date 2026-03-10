import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../types/generated/ts/db/schema.generated";
import { getConnectionUrl } from "./connectionUrl";

const connectionString = getConnectionUrl();
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export { schema };
