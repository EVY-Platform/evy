import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { GetRequest, GetResponse } from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import * as resources from "../procedures/resources";
import * as services from "../procedures/services";
import { sync } from "../procedures/sync";
import {
	EXTERNAL_TEST_RESOURCE,
	EXTERNAL_TEST_SERVICE_DESCRIPTOR,
	EXTERNAL_TEST_SERVICE_ID,
} from "./externalServiceFixture";

const db = null as unknown as EvyDb;

const EXTERNAL_SERVICE_ID = EXTERNAL_TEST_SERVICE_ID;
const EPOCH = "1970-01-01T00:00:00.000Z";
const RECENT_CURSOR = new Date(Date.now() - 86_400_000).toISOString();

function buildMockCatalog(): Awaited<
	ReturnType<typeof resources.discoverResources>
> {
	return {
		services: [
			{
				id: EVY_CORE_SERVICE,
				name: "evy",
				resources: [
					{ id: "flows", name: "flow" },
					{ id: "pages", name: "page" },
					{ id: "rows", name: "row" },
					{ id: "devices", name: "device" },
					{ id: "organisations", name: "organisation" },
					{ id: "services", name: "service" },
					{ id: "providers", name: "provider" },
					{ id: EVY_CORE_RESOURCE.RESOURCES, name: "resource" },
					{ id: "files", name: "file" },
					{ id: "addresses", name: "address" },
					{ id: "messages", name: "message" },
				],
			},
			{
				...EXTERNAL_TEST_SERVICE_DESCRIPTOR,
				resources: [
					{
						id: EXTERNAL_TEST_RESOURCE.SELLING_REASONS,
						name: "selling_reasons",
					},
					{
						id: EXTERNAL_TEST_RESOURCE.CONDITIONS,
						name: "conditions",
					},
					{ id: EXTERNAL_TEST_RESOURCE.DURATIONS, name: "durations" },
					{ id: EXTERNAL_TEST_RESOURCE.AREAS, name: "areas" },
					{ id: EXTERNAL_TEST_RESOURCE.RECORDS, name: "records" },
				],
			},
		],
	};
}

function buildMockGetResponse(items: { id: string }[]): GetResponse {
	return items;
}

let getImpl = async (params: GetRequest): Promise<GetResponse> =>
	buildMockGetResponse([
		{
			id: `${params.resource}-mock-1`,
			visibility:
				params.resource === "addresses"
					? ("private" as const)
					: ("public" as const),
		},
	]);

let forwardGetImpl = async (
	_serviceName: string,
	params: GetRequest,
): Promise<GetResponse> =>
	buildMockGetResponse([
		{
			id: `${params.resource}-mock-1`,
			visibility: "public" as const,
		},
	]);

function resetSyncMocks(): void {
	getImpl = async (params) =>
		buildMockGetResponse([
			{
				id: `${params.resource}-mock-1`,
				visibility:
					params.resource === "addresses"
						? ("private" as const)
						: ("public" as const),
			},
		]);
	forwardGetImpl = async (_serviceName, params) =>
		buildMockGetResponse([
			{
				id: `${params.resource}-mock-1`,
				visibility: "public" as const,
			},
		]);
}

describe("sync", () => {
	let getSpy: ReturnType<typeof spyOn>;
	let discoverResourcesSpy: ReturnType<typeof spyOn>;
	let forwardGetSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		resetSyncMocks();
		getSpy = spyOn(data, "get").mockImplementation((_db, params) =>
			getImpl(params),
		);
		discoverResourcesSpy = spyOn(
			resources,
			"discoverResources",
		).mockResolvedValue(buildMockCatalog());
		forwardGetSpy = spyOn(services, "forwardGet").mockImplementation(
			(serviceName, params) => forwardGetImpl(serviceName, params),
		);
	});

	afterEach(() => {
		getSpy.mockRestore();
		discoverResourcesSpy.mockRestore();
		forwardGetSpy.mockRestore();
	});

	it("returns changed rows in the unified data response", async () => {
		const result = await sync({ cursor: EPOCH }, db);

		expect(result).toEqual({ data: result.data, cursor: result.cursor });
		expect(result.data).toBeDefined();
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("includes evy core resources (except devices and catalog) in data", async () => {
		const result = await sync({ cursor: EPOCH }, db);

		const evyRows = result.data.filter(
			(row) => row.service === EVY_CORE_SERVICE,
		);
		const evyResourceNames = evyRows.map((row) => row.resource);

		expect(evyResourceNames).toContain("flows");
		expect(evyResourceNames).toContain("pages");
		expect(evyResourceNames).toContain("rows");
		expect(evyResourceNames).toContain("services");
		expect(evyResourceNames).toContain("organisations");
		expect(evyResourceNames).toContain("providers");
		expect(evyResourceNames).toContain("files");
		expect(evyResourceNames).toContain("addresses");
		expect(evyResourceNames).toContain("messages");
		expect(evyResourceNames).not.toContain("devices");
		expect(evyResourceNames).toContain(EVY_CORE_RESOURCE.RESOURCES);

		const addressesRow = evyRows.find(
			(row) => row.resource === "addresses",
		);
		expect(addressesRow).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "addresses",
			value: [{ id: "addresses-mock-1", visibility: "private" }],
		});
	});

	it("includes the resource catalog singleton when discovery succeeds", async () => {
		const result = await sync({ cursor: EPOCH }, db);

		const catalogRow = result.data.find(
			(row) =>
				row.service === EVY_CORE_SERVICE &&
				row.resource === EVY_CORE_RESOURCE.RESOURCES,
		);
		expect(catalogRow?.value).toEqual(buildMockCatalog());
	});

	it("includes external service resources in data", async () => {
		const result = await sync({ cursor: EPOCH }, db);

		const marketplaceRows = result.data.filter(
			(row) => row.service === EXTERNAL_SERVICE_ID,
		);
		const rowResources = marketplaceRows.map((row) => row.resource);

		expect(rowResources).toContain(EXTERNAL_TEST_RESOURCE.SELLING_REASONS);
		expect(rowResources).toContain(EXTERNAL_TEST_RESOURCE.CONDITIONS);
		expect(rowResources).toContain(EXTERNAL_TEST_RESOURCE.DURATIONS);
		expect(rowResources).toContain(EXTERNAL_TEST_RESOURCE.AREAS);
		expect(rowResources).toContain(EXTERNAL_TEST_RESOURCE.RECORDS);
		expect(rowResources).not.toContain("messages");
	});

	it("passes updatedAfter to getCore", async () => {
		getImpl = async (params) => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		await sync({ cursor: EPOCH }, db);
	});

	it("passes updatedAfter to fetchService", async () => {
		forwardGetImpl = async (_serviceName, params) => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		await sync({ cursor: EPOCH }, db);
	});

	it("returns only the catalog when no resource data changed", async () => {
		getImpl = async () => buildMockGetResponse([]);
		forwardGetImpl = async () => buildMockGetResponse([]);
		const result = await sync({ cursor: "2999-01-01T00:00:00.000Z" }, db);
		expect(result.data).toEqual([
			{
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.RESOURCES,
				value: buildMockCatalog(),
			},
		]);
	});

	it("reports an unreachable service instead of failing the sync", async () => {
		forwardGetImpl = async (serviceName) => {
			if (serviceName === EXTERNAL_SERVICE_ID) {
				throw new Error("test-service unavailable");
			}
			return buildMockGetResponse([]);
		};

		const result = await sync({ cursor: EPOCH }, db);

		expect(result.errors?.length).toBeGreaterThan(0);
		expect(result.errors?.[0]?.message).toContain(
			"test-service unavailable",
		);
	});

	it("still returns core rows when an external service is down", async () => {
		getImpl = async () =>
			[
				{ id: "core-1", updatedAt: "2026-01-01T00:00:00.000Z" },
			] as unknown as GetResponse;
		forwardGetImpl = async () => {
			throw new Error("down");
		};

		const result = await sync({ cursor: EPOCH }, db);

		expect(result.data.length).toBeGreaterThan(0);
		expect(result.errors?.length).toBeGreaterThan(0);
	});

	it("holds the cursor when any resource failed", async () => {
		getImpl = async () =>
			[
				{ id: "core-1", updatedAt: "2099-01-01T00:00:00.000Z" },
			] as unknown as GetResponse;
		forwardGetImpl = async () => {
			throw new Error("down");
		};

		const result = await sync({ cursor: RECENT_CURSOR }, db);

		expect(result.cursor).toBe(RECENT_CURSOR);
	});

	it("omits the catalog singleton when discovery is incomplete", async () => {
		discoverResourcesSpy.mockResolvedValue({
			...buildMockCatalog(),
			errors: [
				{
					service: EXTERNAL_SERVICE_ID,
					message: "test-service unavailable",
				},
			],
		});

		const result = await sync({ cursor: EPOCH }, db);

		expect(
			result.data.some(
				(row) => row.resource === EVY_CORE_RESOURCE.RESOURCES,
			),
		).toBe(false);
		expect(
			result.errors?.some((entry) => entry.resource === "resources"),
		).toBe(true);
		expect(result.cursor).toBe(EPOCH);
	});

	it("omits errors entirely when everything succeeded", async () => {
		getImpl = async () => buildMockGetResponse([]);
		forwardGetImpl = async () => buildMockGetResponse([]);

		const result = await sync({ cursor: EPOCH }, db);

		expect(result.errors).toBeUndefined();
	});

	it("keeps a failing core resource from hiding the others", async () => {
		getImpl = async (params) => {
			if (params.resource === "rows")
				throw new Error("rows table broken");
			return [
				{ id: "ok", updatedAt: "2026-01-01T00:00:00.000Z" },
			] as unknown as GetResponse;
		};
		forwardGetImpl = async () => buildMockGetResponse([]);

		const result = await sync({ cursor: EPOCH }, db);

		expect(result.data.some((row) => row.resource !== "rows")).toBe(true);
		expect(result.errors?.some((entry) => entry.resource === "rows")).toBe(
			true,
		);
	});

	it("each data row has required shape", async () => {
		const result = await sync({ cursor: EPOCH }, db);
		for (const row of result.data) {
			expect(typeof row.service).toBe("string");
			expect(row.service.length).toBeGreaterThan(0);
			expect(typeof row.resource).toBe("string");
			expect(row.resource.length).toBeGreaterThan(0);
			expect(row.value).toBeDefined();
			if (row.resource === EVY_CORE_RESOURCE.RESOURCES) {
				expect(row.value).toEqual(buildMockCatalog());
				continue;
			}
			expect(row.value).toHaveLength(1);
			expect(row.value).toEqual([
				{
					id: `${row.resource}-mock-1`,
					visibility:
						row.resource === "addresses" ? "private" : "public",
				},
			]);
		}
	});

	describe("cursor", () => {
		it("issues a cursor derived from the newest updatedAt it returned", async () => {
			getImpl = async () =>
				[
					{ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" },
					{ id: "b", updatedAt: "2026-03-01T00:00:00.000Z" },
					{ id: "c", updatedAt: "2026-02-01T00:00:00.000Z" },
				] as unknown as GetResponse;
			forwardGetImpl = async () => buildMockGetResponse([]);

			const result = await sync({ cursor: EPOCH }, db);

			expect(result.cursor).toBe("2026-03-01T00:00:00.000Z");
		});

		it("holds the cursor steady when nothing changed", async () => {
			getImpl = async () => buildMockGetResponse([]);
			forwardGetImpl = async () => buildMockGetResponse([]);

			const result = await sync({ cursor: RECENT_CURSOR }, db);

			expect(result.cursor).toBe(RECENT_CURSOR);
		});

		it("treats a missing cursor as a full sync", async () => {
			const seen: string[] = [];
			getImpl = async (params) => {
				seen.push(params.filter?.updatedAfter ?? "none");
				return buildMockGetResponse([]);
			};
			forwardGetImpl = async () => buildMockGetResponse([]);

			await sync({}, db);

			expect(seen.every((value) => value === EPOCH)).toBe(true);
		});
	});
});
