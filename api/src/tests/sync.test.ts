import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { GetRequest, GetResponse } from "evy-types";
import {
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAMES,
	EVY_CORE_RESOURCE_VISIBILITY,
	EVY_CORE_RESOURCES,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
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
				resources: [...EVY_CORE_RESOURCES],
			},
			EXTERNAL_TEST_SERVICE_DESCRIPTOR,
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

type SyncScope = Parameters<typeof data.getSyncRows>[2];

function mockRowFor(resource: string) {
	return {
		id: `${resource}-mock-1`,
		visibility:
			EVY_CORE_RESOURCE_VISIBILITY[resource] ?? ("public" as const),
	};
}

let getSyncRowsImpl = async (
	resource: string,
	_scope: SyncScope,
): Promise<GetResponse> => [mockRowFor(resource)];

function resetSyncMocks(): void {
	getSyncRowsImpl = async (resource) => [mockRowFor(resource)];
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
	let getSyncRowsSpy: ReturnType<typeof spyOn>;
	let discoverResourcesSpy: ReturnType<typeof spyOn>;
	let forwardGetSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		resetSyncMocks();
		getSpy = spyOn(data, "get").mockImplementation((_db, params) =>
			getImpl(params),
		);
		getSyncRowsSpy = spyOn(data, "getSyncRows").mockImplementation(
			(_db, resource, scope) => getSyncRowsImpl(resource, scope),
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
		getSyncRowsSpy.mockRestore();
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
		expect(evyResourceNames).toContain("formatters");
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

	it("passes updatedAfter to the core read", async () => {
		getSyncRowsImpl = async (resource, scope) => {
			expect(scope.updatedAfter).toBe(EPOCH);
			return buildMockGetResponse([{ id: `${resource}-1` }]);
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
		getSyncRowsImpl = async () => buildMockGetResponse([]);
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
		getSyncRowsImpl = async () =>
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
		getSyncRowsImpl = async () =>
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
		getSyncRowsImpl = async () => buildMockGetResponse([]);
		forwardGetImpl = async () => buildMockGetResponse([]);

		const result = await sync({ cursor: EPOCH }, db);

		expect(result.errors).toBeUndefined();
	});

	it("keeps a failing core resource from hiding the others", async () => {
		getSyncRowsImpl = async (resource) => {
			if (resource === "rows") throw new Error("rows table broken");
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
			expect(row.value).toEqual([mockRowFor(row.resource)]);
		}
	});

	it("reads every resource the sync loop asks for", async () => {
		const attempted: string[] = [];
		getSyncRowsImpl = async (resource) => {
			attempted.push(resource);
			return [mockRowFor(resource)];
		};

		const result = await sync({ cursor: EPOCH }, db);

		const expected = EVY_CORE_RESOURCE_NAMES.filter(
			(name) =>
				name !== EVY_CORE_RESOURCE.DEVICES &&
				name !== EVY_CORE_RESOURCE.RESOURCES,
		);
		expect(attempted.toSorted()).toEqual([...expected].toSorted());
		expect(result.errors).toBeUndefined();
	});

	describe("ownership-scoped rows", () => {
		const OWNED_MESSAGE_ID = "0f5f1a1e-6a1e-4f6e-9c1a-2b3c4d5e6f70";
		const OWNED_ITEM_ID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
		const OWNED_ADDRESS_ID = "2b3c4d5e-6f70-4a1b-8c2d-3e4f5a6b7c8d";

		function ownershipFor(resource: string) {
			const call = getSyncRowsSpy.mock.calls.find(
				(entry) => entry[1] === resource,
			);
			return call?.[2] as SyncScope | undefined;
		}

		it("reads every core resource through the ownership-scoped path", async () => {
			await sync({ cursor: EPOCH }, db);

			for (const resource of [
				EVY_CORE_RESOURCE.FLOWS,
				EVY_CORE_RESOURCE.ADDRESSES,
				EVY_CORE_RESOURCE.MESSAGES,
				EVY_CORE_RESOURCE.FORMATTERS,
			]) {
				expect(ownershipFor(resource)).toBeDefined();
			}
			expect(getSpy).not.toHaveBeenCalled();
		});

		it("passes the resumed-from point to every resource", async () => {
			await sync({ cursor: RECENT_CURSOR }, db);

			expect(ownershipFor(EVY_CORE_RESOURCE.FLOWS)?.updatedAfter).toBe(
				RECENT_CURSOR,
			);
		});

		it("gives each resource only the ids owned in it", async () => {
			await sync(
				{
					cursor: EPOCH,
					ownedServiceResources: [
						{
							service: EVY_CORE_SERVICE,
							resource: EVY_CORE_RESOURCE.MESSAGES,
							ids: [OWNED_MESSAGE_ID],
						},
						{
							service: EVY_CORE_SERVICE,
							resource: EVY_CORE_RESOURCE.ADDRESSES,
							ids: [OWNED_ADDRESS_ID],
						},
					],
				},
				db,
			);

			expect(ownershipFor(EVY_CORE_RESOURCE.MESSAGES)?.ownedIds).toEqual([
				OWNED_MESSAGE_ID,
			]);
			expect(ownershipFor(EVY_CORE_RESOURCE.ADDRESSES)?.ownedIds).toEqual(
				[OWNED_ADDRESS_ID],
			);
			expect(ownershipFor(EVY_CORE_RESOURCE.FLOWS)?.ownedIds).toEqual([]);
		});

		it("passes records owned in other services through as foreign keys", async () => {
			const externalGroup = {
				service: EXTERNAL_SERVICE_ID,
				resource: EXTERNAL_TEST_RESOURCE.RECORDS,
				ids: [OWNED_ITEM_ID],
			};

			await sync(
				{ cursor: EPOCH, ownedServiceResources: [externalGroup] },
				db,
			);

			expect(
				ownershipFor(EVY_CORE_RESOURCE.MESSAGES)?.ownedForeignKeys,
			).toEqual([externalGroup]);
		});

		it("keeps a failing resource from hiding the rest, and holds the cursor", async () => {
			getSyncRowsImpl = async (resource) => {
				if (resource === EVY_CORE_RESOURCE.ADDRESSES) {
					throw new Error("addresses table broken");
				}
				return [mockRowFor(resource)];
			};

			const result = await sync({ cursor: RECENT_CURSOR }, db);

			expect(result.errors).toContainEqual({
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.ADDRESSES,
				message: "addresses table broken",
			});
			expect(
				result.data.some(
					(row) => row.resource === EVY_CORE_RESOURCE.FLOWS,
				),
			).toBe(true);
			expect(result.cursor).toBe(RECENT_CURSOR);
		});
	});

	describe("cursor", () => {
		it("issues a cursor derived from the newest updatedAt it returned", async () => {
			getSyncRowsImpl = async () =>
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
			getSyncRowsImpl = async () => buildMockGetResponse([]);
			forwardGetImpl = async () => buildMockGetResponse([]);

			const result = await sync({ cursor: RECENT_CURSOR }, db);

			expect(result.cursor).toBe(RECENT_CURSOR);
		});

		it("treats a missing cursor as a full sync", async () => {
			const seen: string[] = [];
			getSyncRowsImpl = async (_resource, scope) => {
				seen.push(scope.updatedAfter ?? "none");
				return buildMockGetResponse([]);
			};
			forwardGetImpl = async () => buildMockGetResponse([]);

			await sync({}, db);

			expect(seen.every((value) => value === EPOCH)).toBe(true);
		});
	});
});
