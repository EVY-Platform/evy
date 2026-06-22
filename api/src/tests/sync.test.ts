import { describe, expect, it } from "bun:test";
import type { GetRequest, GetResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import type { EvyDb } from "../database/db";
import { sync } from "../procedures/sync";

const db = null as unknown as EvyDb;

const MARKETPLACE_SERVICE_ID = MARKETPLACE_SERVICE;
const EPOCH = "1970-01-01T00:00:00.000Z";

function buildMockGetResponse(items: { id: string }[]): GetResponse {
	return items;
}

function makeMocks() {
	const getCore = async (params: GetRequest): Promise<GetResponse> =>
		buildMockGetResponse([{ id: `${params.resource}-mock-1` }]);

	const fetchService = async (
		_serviceName: string,
		params: GetRequest,
	): Promise<GetResponse> =>
		buildMockGetResponse([{ id: `${params.resource}-mock-1` }]);

	const listExternalResources = async () => [
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

	return { getCore, fetchService, listExternalResources };
}

describe("sync", () => {
	it("returns changed rows in the unified data response", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, db, deps);

		expect(result).toEqual({ data: result.data });
		expect(result.data).toBeDefined();
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("includes evy core resources (except devices) in data", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, db, deps);

		const evyRows = result.data.filter(
			(row) => row.service === EVY_CORE_SERVICE,
		);
		const evyResourceNames = evyRows.map((row) => row.resource);

		expect(evyResourceNames).toContain("sdui");
		expect(evyResourceNames).toContain("services");
		expect(evyResourceNames).toContain("organisations");
		expect(evyResourceNames).toContain("providers");
		expect(evyResourceNames).toContain("files");
		expect(evyResourceNames).toContain("serviceResources");
		expect(evyResourceNames).not.toContain("devices");
	});

	it("includes external service resources in data", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, db, deps);

		const marketplaceRows = result.data.filter(
			(row) => row.service === MARKETPLACE_SERVICE_ID,
		);
		const rowResources = marketplaceRows.map((row) => row.resource);

		expect(rowResources).toContain(MARKETPLACE_RESOURCE.SELLING_REASONS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.CONDITIONS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.DURATIONS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.AREAS);
		expect(rowResources).toContain(MARKETPLACE_RESOURCE.ITEMS);
	});

	it("passes updatedAfter to getCore", async () => {
		const getCore = async (params: GetRequest): Promise<GetResponse> => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		const deps = { ...makeMocks(), getCore };
		await sync({ lastSyncTime: EPOCH }, db, deps);
	});

	it("passes updatedAfter to fetchService", async () => {
		const fetchService = async (
			_serviceName: string,
			params: GetRequest,
		): Promise<GetResponse> => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		const deps = { ...makeMocks(), fetchService };
		await sync({ lastSyncTime: EPOCH }, db, deps);
	});

	it("returns only an empty data array when nothing changed", async () => {
		const getCore = async (): Promise<GetResponse> => buildMockGetResponse([]);
		const fetchService = async (): Promise<GetResponse> =>
			buildMockGetResponse([]);
		const deps = { ...makeMocks(), getCore, fetchService };
		const result = await sync(
			{ lastSyncTime: "2999-01-01T00:00:00.000Z" },
			db,
			deps,
		);
		expect(result).toEqual({ data: [] });
	});

	it("rejects missing lastSyncTime", async () => {
		const deps = makeMocks();
		await expect(sync({}, db, deps)).rejects.toThrow();
		await expect(sync(null, db, deps)).rejects.toThrow();
		await expect(sync(undefined, db, deps)).rejects.toThrow();
	});

	it("rejects invalid lastSyncTime format", async () => {
		const deps = makeMocks();
		await expect(
			sync({ lastSyncTime: "not-a-date" }, db, deps),
		).rejects.toThrow();
	});

	it("propagates forwardGet errors for external services", async () => {
		const fetchService = async (serviceName: string): Promise<GetResponse> => {
			if (serviceName === MARKETPLACE_SERVICE_ID) {
				throw new Error("gRPC service unavailable");
			}
			return buildMockGetResponse([]);
		};
		const deps = { ...makeMocks(), fetchService };
		await expect(sync({ lastSyncTime: EPOCH }, db, deps)).rejects.toThrow(
			"gRPC service unavailable",
		);
	});

	it("each data row has required shape", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, db, deps);
		for (const row of result.data) {
			expect(typeof row.service).toBe("string");
			expect(row.service.length).toBeGreaterThan(0);
			expect(typeof row.resource).toBe("string");
			expect(row.resource.length).toBeGreaterThan(0);
			expect(row.value).toBeDefined();
			expect(row.value).toHaveLength(1);
			expect(row.value).toEqual([{ id: `${row.resource}-mock-1` }]);
		}
	});

	it("syncs serviceResources as ordinary evy core data", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, db, deps);

		const serviceResourcesRow = result.data.find(
			(row) =>
				row.service === EVY_CORE_SERVICE && row.resource === "serviceResources",
		);
		expect(serviceResourcesRow).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "serviceResources",
			value: [{ id: "serviceResources-mock-1" }],
		});
	});
});
