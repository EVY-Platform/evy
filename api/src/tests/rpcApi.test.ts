import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const { api } = await import("../procedures/rpc");

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
});

describe("api JSON-RPC handler", () => {
	it("rejects non-core service API method requests", async () => {
		await expect(
			api(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.ITEMS,
					method: "not-search",
					filter: {
						id: crypto.randomUUID(),
					},
				},
				dataDb,
			),
		).rejects.toThrow('API calls are only supported for service "evy"');
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.ITEMS,
					filter: {
						id: crypto.randomUUID(),
					},
				},
				dataDb,
			),
		).rejects.toThrow("ApiRequest validation failed");
	});

	it("rejects unknown evy core API methods", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "unknown",
				},
				dataDb,
			),
		).rejects.toThrow("Unknown evy API method: unknown");
	});
});
