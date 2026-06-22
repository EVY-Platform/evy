import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { GetResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import * as schema from "../../../types/generated/ts/db/schema.generated";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const forwardGetMock = mock(
	async (
		_serviceName: string,
		params: {
			service: string;
			resource: string;
			method: string;
			filter?: {
				id?: string;
			};
		},
	): Promise<GetResponse> => {
		return params.filter?.id ? [{ id: params.filter.id }] : [];
	},
);

mock.module("../procedures/services", () => ({
	forwardCreate: mock(),
	forwardGet: forwardGetMock,
	forwardUpdate: mock(),
	wireGrpcEvents: mock(),
}));

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const { api } = await import("../procedures/rpc");

const MARKETPLACE_SERVICE_ID = MARKETPLACE_SERVICE;
const EVY_SERVICE_ID = EVY_CORE_SERVICE;

async function seedServiceResources(): Promise<void> {
	const nowIso = new Date().toISOString();

	await testDb.insert(schema.service).values([
		{
			id: MARKETPLACE_SERVICE_ID,
			name: "marketplace",
			description: "Marketplace",
			sortOrder: 1,
			createdAt: nowIso,
			updatedAt: nowIso,
		},
		{
			id: EVY_SERVICE_ID,
			name: "evy",
			description: "EVY core",
			sortOrder: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		},
	]);

	await testDb.insert(schema.serviceResource).values([
		{
			id: MARKETPLACE_RESOURCE.SELLING_REASONS,
			fkServiceId: MARKETPLACE_SERVICE_ID,
			name: "selling_reason",
			createdAt: nowIso,
			updatedAt: nowIso,
		},
		{
			id: MARKETPLACE_RESOURCE.CONDITIONS,
			fkServiceId: MARKETPLACE_SERVICE_ID,
			name: "condition",
			createdAt: nowIso,
			updatedAt: nowIso,
		},
		{
			id: MARKETPLACE_RESOURCE.DURATIONS,
			fkServiceId: MARKETPLACE_SERVICE_ID,
			name: "duration",
			createdAt: nowIso,
			updatedAt: nowIso,
		},
		{
			id: MARKETPLACE_RESOURCE.AREAS,
			fkServiceId: MARKETPLACE_SERVICE_ID,
			name: "area",
			createdAt: nowIso,
			updatedAt: nowIso,
		},
		{
			id: MARKETPLACE_RESOURCE.ITEMS,
			fkServiceId: MARKETPLACE_SERVICE_ID,
			name: "item",
			createdAt: nowIso,
			updatedAt: nowIso,
		},
		{
			id: "d23cd318-3df4-486f-92d8-77f84402e63c",
			fkServiceId: EVY_SERVICE_ID,
			name: "flow",
			createdAt: nowIso,
			updatedAt: nowIso,
		},
	]);
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	forwardGetMock.mockClear();
	await clearAllTestTables(testDb);
	await seedServiceResources();
});

describe("api JSON-RPC handler", () => {
	it("forwards non-search marketplace API function requests to the owning service", async () => {
		const itemId = crypto.randomUUID();
		const result = await api(
			{
				service: MARKETPLACE_SERVICE_ID,
				resource: MARKETPLACE_RESOURCE.ITEMS,
				method: "not-search",
				filter: {
					id: itemId,
				},
			},
			dataDb,
		);

		expect(result).toEqual([{ id: itemId }]);
		expect(forwardGetMock).toHaveBeenCalledTimes(1);
		expect(forwardGetMock).toHaveBeenCalledWith(MARKETPLACE_SERVICE_ID, {
			service: MARKETPLACE_SERVICE_ID,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			method: "not-search",
			filter: {
				id: itemId,
			},
		});
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api(
				{
					service: MARKETPLACE_SERVICE_ID,
					resource: MARKETPLACE_RESOURCE.ITEMS,
					filter: {
						id: crypto.randomUUID(),
					},
				},
				dataDb,
			),
		).rejects.toThrow("ApiRequest validation failed");

		expect(forwardGetMock).not.toHaveBeenCalled();
	});

	it("forwards API requests without checking service/resource pairs locally", async () => {
		const itemId = crypto.randomUUID();
		const result = await api(
			{
				service: MARKETPLACE_SERVICE_ID,
				resource: "sdui",
				method: "not-search",
				filter: {
					id: itemId,
				},
			},
			dataDb,
		);

		expect(result).toEqual([{ id: itemId }]);
		expect(forwardGetMock).toHaveBeenCalledWith(MARKETPLACE_SERVICE_ID, {
			service: MARKETPLACE_SERVICE_ID,
			resource: "sdui",
			method: "not-search",
			filter: {
				id: itemId,
			},
		});
	});
});
