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
	buildMockGetResponse([{ id: `${params.resource}-mock-1` }]);

let forwardGetImpl = async (
	_serviceName: string,
	params: GetRequest,
): Promise<GetResponse> =>
	buildMockGetResponse([{ id: `${params.resource}-mock-1` }]);

function resetSyncMocks(): void {
	getImpl = async (params) =>
		buildMockGetResponse([{ id: `${params.resource}-mock-1` }]);
	forwardGetImpl = async (_serviceName, params) =>
		buildMockGetResponse([{ id: `${params.resource}-mock-1` }]);
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

		expect(result).toEqual({ data: result.data });
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
		expect(evyResourceNames).toContain("serviceResources");
		expect(evyResourceNames).not.toContain("devices");

		const serviceResourcesRow = evyRows.find(
			(row) => row.resource === "serviceResources",
		);
		expect(serviceResourcesRow).toEqual({
			service: EVY_CORE_SERVICE,
			resource: "serviceResources",
			value: [{ id: "serviceResources-mock-1" }],
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
		expect(result).toEqual({ data: [] });
	});

	it("propagates forwardGet errors for external services", async () => {
		forwardGetImpl = async (serviceName) => {
			if (serviceName === MARKETPLACE_SERVICE_ID) {
				throw new Error("gRPC service unavailable");
			}
			return buildMockGetResponse([]);
		};
		await expect(sync({ lastSyncTime: EPOCH }, db)).rejects.toThrow(
			"gRPC service unavailable",
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
			expect(row.value).toEqual([{ id: `${row.resource}-mock-1` }]);
		}
	});
});
