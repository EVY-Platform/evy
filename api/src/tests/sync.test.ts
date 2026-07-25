import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { GetRequest, GetResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import * as services from "../procedures/services";
import { sync } from "../procedures/sync";

const db = null as unknown as EvyDb;

const MARKETPLACE_SERVICE_ID = MARKETPLACE_SERVICE;
const EPOCH = "1970-01-01T00:00:00.000Z";

function buildMockGetResponse(items: { id: string }[]): GetResponse {
	return items;
}

const externalResources = [
	{
		serviceId: MARKETPLACE_SERVICE_ID,
		resourceId: MARKETPLACE_RESOURCE.SELLING_REASONS,
	},
	{
		serviceId: MARKETPLACE_SERVICE_ID,
		resourceId: MARKETPLACE_RESOURCE.CONDITIONS,
	},
	{
		serviceId: MARKETPLACE_SERVICE_ID,
		resourceId: MARKETPLACE_RESOURCE.DURATIONS,
	},
	{
		serviceId: MARKETPLACE_SERVICE_ID,
		resourceId: MARKETPLACE_RESOURCE.AREAS,
	},
	{
		serviceId: MARKETPLACE_SERVICE_ID,
		resourceId: MARKETPLACE_RESOURCE.ITEMS,
	},
];

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
	let listExternalServiceResourcesSpy: ReturnType<typeof spyOn>;
	let forwardGetSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		resetSyncMocks();
		getSpy = spyOn(data, "get").mockImplementation((_db, params) =>
			getImpl(params),
		);
		listExternalServiceResourcesSpy = spyOn(
			data,
			"listExternalServiceResources",
		).mockResolvedValue(externalResources);
		forwardGetSpy = spyOn(services, "forwardGet").mockImplementation(
			(serviceName, params) => forwardGetImpl(serviceName, params),
		);
	});

	afterEach(() => {
		getSpy.mockRestore();
		listExternalServiceResourcesSpy.mockRestore();
		forwardGetSpy.mockRestore();
	});

	it("returns changed rows in the unified data response", async () => {
		const result = await sync({ lastSyncTime: EPOCH }, db);

		expect(result).toEqual({ data: result.data, cursor: result.cursor });
		expect(result.data).toBeDefined();
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("includes evy core resources (except devices) in data", async () => {
		const result = await sync({ lastSyncTime: EPOCH }, db);

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
		expect(evyResourceNames).toContain("serviceResources");
		expect(evyResourceNames).not.toContain("devices");

		const addressesRow = evyRows.find(
			(row) => row.resource === "addresses",
		);
		expect(addressesRow).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "addresses",
			value: [{ id: "addresses-mock-1", visibility: "private" }],
		});

		const serviceResourcesRow = evyRows.find(
			(row) => row.resource === "serviceResources",
		);
		expect(serviceResourcesRow).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "serviceResources",
			value: [{ id: "serviceResources-mock-1", visibility: "public" }],
		});
	});

	it("includes external service resources in data", async () => {
		const result = await sync({ lastSyncTime: EPOCH }, db);

		const marketplaceRows = result.data.filter(
			(row) => row.service === MARKETPLACE_SERVICE_ID,
		);
		const rowResources = marketplaceRows.map((row) => row.resource);

		expect(rowResources).toContain(MARKETPLACE_RESOURCE.SELLING_REASONS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.CONDITIONS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.DURATIONS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.AREAS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.ITEMS);
		expect(rowResources).not.toContain("messages");
	});

	it("passes updatedAfter to getCore", async () => {
		getImpl = async (params) => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		await sync({ lastSyncTime: EPOCH }, db);
	});

	it("passes updatedAfter to fetchService", async () => {
		forwardGetImpl = async (_serviceName, params) => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		await sync({ lastSyncTime: EPOCH }, db);
	});

	it("returns only an empty data array when nothing changed", async () => {
		getImpl = async () => buildMockGetResponse([]);
		forwardGetImpl = async () => buildMockGetResponse([]);
		const result = await sync(
			{ lastSyncTime: "2999-01-01T00:00:00.000Z" },
			db,
		);
		expect(result.data).toEqual([]);
	});

	// An unreachable service used to fail the whole sync, taking every other
	// resource down with it.
	it("reports an unreachable service instead of failing the sync", async () => {
		forwardGetImpl = async (serviceName) => {
			if (serviceName === MARKETPLACE_SERVICE_ID) {
				throw new Error("marketplace service unavailable");
			}
			return buildMockGetResponse([]);
		};

		const result = await sync({ lastSyncTime: EPOCH }, db);

		expect(result.errors?.length).toBeGreaterThan(0);
		expect(result.errors?.[0]?.message).toContain(
			"marketplace service unavailable",
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

		const result = await sync({ lastSyncTime: EPOCH }, db);

		expect(result.data.length).toBeGreaterThan(0);
		expect(result.errors?.length).toBeGreaterThan(0);
	});

	// Advancing past a failure would mean the missed resources are never retried.
	it("holds the cursor when any resource failed", async () => {
		getImpl = async () =>
			[
				{ id: "core-1", updatedAt: "2099-01-01T00:00:00.000Z" },
			] as unknown as GetResponse;
		forwardGetImpl = async () => {
			throw new Error("down");
		};

		const result = await sync({ cursor: "2026-01-01T00:00:00.000Z" }, db);

		expect(result.cursor).toBe("2026-01-01T00:00:00.000Z");
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

		const result = await sync({ lastSyncTime: EPOCH }, db);

		expect(result.data.some((row) => row.resource !== "rows")).toBe(true);
		expect(result.errors?.some((entry) => entry.resource === "rows")).toBe(
			true,
		);
	});

	it("each data row has required shape", async () => {
		const result = await sync({ lastSyncTime: EPOCH }, db);
		for (const row of result.data) {
			expect(typeof row.service).toBe("string");
			expect(row.service.length).toBeGreaterThan(0);
			expect(typeof row.resource).toBe("string");
			expect(row.resource.length).toBeGreaterThan(0);
			expect(row.value).toBeDefined();
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

		// A cursor that advanced on an empty response would skip past writes made
		// between the query and the reply.
		it("holds the cursor steady when nothing changed", async () => {
			getImpl = async () => buildMockGetResponse([]);
			forwardGetImpl = async () => buildMockGetResponse([]);

			const result = await sync(
				{ cursor: "2026-05-05T00:00:00.000Z" },
				db,
			);

			expect(result.cursor).toBe("2026-05-05T00:00:00.000Z");
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

		it("still accepts the deprecated lastSyncTime", async () => {
			const seen: string[] = [];
			getImpl = async (params) => {
				seen.push(params.filter?.updatedAfter ?? "none");
				return buildMockGetResponse([]);
			};
			forwardGetImpl = async () => buildMockGetResponse([]);

			await sync({ lastSyncTime: "2026-04-04T00:00:00.000Z" }, db);

			expect(
				seen.every((value) => value === "2026-04-04T00:00:00.000Z"),
			).toBe(true);
		});

		it("prefers the cursor over lastSyncTime when both are sent", async () => {
			const seen: string[] = [];
			getImpl = async (params) => {
				seen.push(params.filter?.updatedAfter ?? "none");
				return buildMockGetResponse([]);
			};
			forwardGetImpl = async () => buildMockGetResponse([]);

			await sync(
				{
					cursor: "2026-06-06T00:00:00.000Z",
					lastSyncTime: "2020-01-01T00:00:00.000Z",
				},
				db,
			);

			expect(
				seen.every((value) => value === "2026-06-06T00:00:00.000Z"),
			).toBe(true);
		});
	});
});
