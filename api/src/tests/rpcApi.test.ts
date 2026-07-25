import {
	afterAll,
	afterEach,
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
import { PROCEDURES, proceduresForService } from "evy-types/procedures";
import { assertHandlersMatchRegistry } from "../procedures/coreApi";
import {
	type PlacesClientLike,
	setPlacesClientForTests,
} from "../procedures/placeSearch";
import { rateLimiter } from "../procedures/rateLimit";
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
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.ITEMS,
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
					service: MARKETPLACE_SERVICE,
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
			"sync",
		]);
	});

	it("fails when a declared procedure has no handler", () => {
		expect(() =>
			assertHandlersMatchRegistry(["sync", "place_search"], ["sync"]),
		).toThrow("declared without a handler: place_search");
	});

	it("fails when a handler is reachable but undeclared", () => {
		// The dangerous direction: undeclared means no rate limit was applied.
		expect(() =>
			assertHandlersMatchRegistry(["sync"], ["sync", "smuggled"]),
		).toThrow("handled but not declared");
	});

	it("carries the rate limit and result attributes for place_search", () => {
		expect(PROCEDURES.place_search.perMinute).toBe(30);
		expect(PROCEDURES.place_search.resultAttributes).toContain("street");
		expect(PROCEDURES.sync.perMinute).toBeNull();
	});
});

describe("api rate limiting", () => {
	// A stub client, so the limit is reached without making real Places calls.
	beforeEach(() => {
		rateLimiter.reset();
		setPlacesClientForTests({
			autocompletePlaces: async () => [{ suggestions: [] }],
			getPlace: async () => [{}],
		} as unknown as PlacesClientLike);
	});

	afterEach(() => {
		setPlacesClientForTests(undefined);
	});

	it("stops a caller that exceeds a procedure's declared limit", async () => {
		const perMinute = PROCEDURES.place_search.perMinute ?? 0;
		const call = () =>
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "place_search",
					data: { input: "Sydney" },
				},
				dataDb,
				"socket-limit",
			);

		for (let i = 0; i < perMinute; i++) {
			await call();
		}

		await expect(call()).rejects.toThrow(
			'Rate limit exceeded for "place_search"',
		);
	});

	it("does not let one caller exhaust another caller's budget", async () => {
		const perMinute = PROCEDURES.place_search.perMinute ?? 0;
		for (let i = 0; i < perMinute; i++) {
			await api(
				{
					service: EVY_CORE_SERVICE,
					method: "place_search",
					data: { input: "Sydney" },
				},
				dataDb,
				"socket-noisy",
			);
		}

		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "place_search",
					data: { input: "Sydney" },
				},
				dataDb,
				"socket-quiet",
			),
		).resolves.toBeDefined();
	});
});
