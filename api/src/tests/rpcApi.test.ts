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
import { PROCEDURES, proceduresForService } from "evy-types/procedures";
import { assertHandlersMatchRegistry } from "../procedures/coreApi";
import {
	EXTERNAL_TEST_RESOURCE,
	EXTERNAL_TEST_SERVICE_ID,
} from "./externalServiceFixture";
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
	it("rejects a procedure the registry does not declare for that service", async () => {
		await expect(
			api(
				{
					service: EXTERNAL_TEST_SERVICE_ID,
					resource: EXTERNAL_TEST_RESOURCE.RECORDS,
					method: "not-search",
					filter: {
						id: crypto.randomUUID(),
					},
				},
				dataDb,
			),
		).rejects.toThrow('Procedure "not-search" is not declared for service');
	});

	it("rejects a core procedure addressed to another service", async () => {
		// place_search exists, but not on marketplace - the pairing is checked,
		// not just the name.
		await expect(
			api(
				{
					service: EXTERNAL_TEST_SERVICE_ID,
					method: "place_search",
					data: { input: "Sydney" },
				},
				dataDb,
			),
		).rejects.toThrow(
			'Procedure "place_search" is not declared for service',
		);
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api(
				{
					service: EXTERNAL_TEST_SERVICE_ID,
					resource: EXTERNAL_TEST_RESOURCE.RECORDS,
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

	it("rejects api{method:sync}", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "sync",
					data: { cursor: "1970-01-01T00:00:00.000Z" },
				},
				dataDb,
			),
		).rejects.toThrow("Unknown evy API method: sync");
	});

	it("rejects a declared procedure whose request fails its schema", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "place_search",
					data: { input: "" },
				},
				dataDb,
			),
		).rejects.toThrow("PlaceSearchRequest validation failed");
	});
});

describe("core procedure registry", () => {
	it("declares every procedure the gateway handles", () => {
		expect(proceduresForService(EVY_CORE_SERVICE).sort()).toEqual([
			"place_search",
		]);
	});

	it("fails when a declared procedure has no handler", () => {
		expect(() => assertHandlersMatchRegistry(["place_search"], [])).toThrow(
			"declared without a handler: place_search",
		);
	});

	it("fails when a handler is reachable but undeclared", () => {
		// The dangerous direction: undeclared means it bypassed the registry contract.
		expect(() =>
			assertHandlersMatchRegistry(
				["place_search"],
				["place_search", "smuggled"],
			),
		).toThrow("handled but not declared");
	});

	it("carries the result attributes for place_search", () => {
		expect(PROCEDURES.place_search.resultAttributes).toContain("street");
	});
});
