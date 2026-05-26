import { beforeEach, describe, expect, it } from "bun:test";
import type { GetRequest, GetResponse, SyncResponse } from "evy-types";
import {
	getServiceNames,
	getServiceResources,
	setServiceRegistry,
} from "evy-types/rpcRequestHelpers";
import {
	EVY_CORE_SERVICE,
	EVY_CORE_RESOURCE_NAMES,
} from "evy-types/coreResources";
import type { buildResourceRegistry } from "../resources";
import { sync } from "../sync";

const EPOCH = "1970-01-01T00:00:00.000Z";

function expectResources(
	result: SyncResponse,
): NonNullable<SyncResponse["resources"]> {
	expect(result.resources).toBeDefined();
	return result.resources as NonNullable<SyncResponse["resources"]>;
}

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

	const buildRegistry: typeof buildResourceRegistry = () => {
		const resources: Record<string, { singular: string; plural: string }> = {};
		const resourcesByService: Record<string, string[]> = {};
		for (const svc of getServiceNames()) {
			const svcResources = getServiceResources(svc) ?? [];
			resourcesByService[svc] = svcResources;
			for (const r of svcResources) {
				if (!resources[r]) {
					resources[r] = {
						singular: r.length > 1 ? r.slice(0, -1) : r,
						plural: r,
					};
				}
			}
		}
		return { resources, resourcesByService };
	};

	return { getCore, fetchService, buildRegistry };
}

beforeEach(() => {
	setServiceRegistry([
		[EVY_CORE_SERVICE, [...EVY_CORE_RESOURCE_NAMES]],
		[
			"marketplace",
			["selling_reasons", "conditions", "durations", "areas", "items"],
		],
	]);
});

describe("sync", () => {
	it("returns resources and data in unified response", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, deps);

		const resources = expectResources(result);
		expect(resources.resources).toBeDefined();
		expect(resources.resourcesByService).toBeDefined();
		expect(result.data).toBeDefined();
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("includes evy core resources (except devices) in data", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, deps);

		const evyRows = result.data.filter(
			(row) => row.service === EVY_CORE_SERVICE,
		);
		const evyResourceNames = evyRows.map((row) => row.resource);

		expect(evyResourceNames).toContain("sdui");
		expect(evyResourceNames).toContain("services");
		expect(evyResourceNames).toContain("organisations");
		expect(evyResourceNames).toContain("providers");
		expect(evyResourceNames).not.toContain("devices");
	});

	it("includes external service resources in data", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, deps);

		const marketplaceRows = result.data.filter(
			(row) => row.service === "marketplace",
		);
		const marketplaceResources = getServiceResources("marketplace") ?? [];
		const rowResources = marketplaceRows.map((row) => row.resource);
		for (const r of marketplaceResources) {
			expect(rowResources).toContain(r);
		}
	});

	it("passes updatedAfter to getCore", async () => {
		const getCore = async (params: GetRequest): Promise<GetResponse> => {
			expect(params.filter?.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${params.resource}-1` }]);
		};
		const deps = { ...makeMocks(), getCore };
		await sync({ lastSyncTime: EPOCH }, deps);
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
		await sync({ lastSyncTime: EPOCH }, deps);
	});

	it("returns empty data and no resources when nothing changed", async () => {
		const getCore = async (): Promise<GetResponse> => buildMockGetResponse([]);
		const fetchService = async (): Promise<GetResponse> =>
			buildMockGetResponse([]);
		const deps = { ...makeMocks(), getCore, fetchService };
		const result = await sync(
			{ lastSyncTime: "2999-01-01T00:00:00.000Z" },
			deps,
		);
		expect(result.data).toEqual([]);
		expect(result.resources).toBeUndefined();
	});

	it("omits resources when no data changes", async () => {
		const getCore = async (): Promise<GetResponse> => buildMockGetResponse([]);
		const fetchService = async (): Promise<GetResponse> =>
			buildMockGetResponse([]);
		const deps = { ...makeMocks(), getCore, fetchService };
		const result = await sync(
			{ lastSyncTime: "2999-01-01T00:00:00.000Z" },
			deps,
		);
		expect(result.resources).toBeUndefined();
	});

	it("rejects missing lastSyncTime", async () => {
		const deps = makeMocks();
		await expect(sync({}, deps)).rejects.toThrow();
		await expect(sync(null, deps)).rejects.toThrow();
		await expect(sync(undefined, deps)).rejects.toThrow();
	});

	it("rejects invalid lastSyncTime format", async () => {
		const deps = makeMocks();
		await expect(sync({ lastSyncTime: "not-a-date" }, deps)).rejects.toThrow();
	});

	it("propagates forwardGet errors for external services", async () => {
		const fetchService = async (serviceName: string): Promise<GetResponse> => {
			if (serviceName === "marketplace") {
				throw new Error("gRPC service unavailable");
			}
			return buildMockGetResponse([]);
		};
		const deps = { ...makeMocks(), fetchService };
		await expect(sync({ lastSyncTime: EPOCH }, deps)).rejects.toThrow(
			"gRPC service unavailable",
		);
	});

	it("each data row has required shape", async () => {
		const deps = makeMocks();
		const result = await sync({ lastSyncTime: EPOCH }, deps);
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
