import { describe, expect, it } from "bun:test";
import type {
	PlaceSearchRequest,
	PlaceSearchResponse,
	SyncRequest,
	SyncResponse,
} from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import type { EvyDb } from "../database/db";
import { coreApi } from "../procedures/coreApi";

const db = null as unknown as EvyDb;
const EPOCH = "1970-01-01T00:00:00.000Z";

function makeCoreApiDeps(options?: {
	syncResponse?: SyncResponse;
	placeSearchResponse?: PlaceSearchResponse;
}) {
	return {
		sync: async (params: SyncRequest) => {
			expect(params.lastSyncTime).toBe(EPOCH);
			return options?.syncResponse ?? { data: [] };
		},
		placeSearch: async (params: PlaceSearchRequest) => {
			expect(params).toEqual({
				input: "28 Rothschild",
				language: "en-US",
				region: "au",
			});
			return options?.placeSearchResponse ?? [];
		},
	};
}

describe("coreApi", () => {
	it("runs sync through the core API dispatcher", async () => {
		const response = {
			data: [
				{
					service: EVY_CORE_SERVICE,
					resource: "flows",
					value: [{ id: "flow-1" }],
				},
			],
		};

		const result = await coreApi(
			{
				service: EVY_CORE_SERVICE,
				method: "sync",
				data: { lastSyncTime: EPOCH },
			},
			db,
			makeCoreApiDeps({ syncResponse: response }),
		);

		expect(result).toEqual(response);
	});

	it("rejects unknown core API methods", async () => {
		await expect(
			coreApi(
				{
					service: EVY_CORE_SERVICE,
					method: "unknown",
				},
				db,
				makeCoreApiDeps(),
			),
		).rejects.toThrow("Unknown evy API method: unknown");
	});

	it("validates sync params", async () => {
		await expect(
			coreApi(
				{
					service: EVY_CORE_SERVICE,
					method: "sync",
					data: { lastSyncTime: "not-a-date" },
				},
				db,
				makeCoreApiDeps(),
			),
		).rejects.toThrow("SyncRequest validation failed");
	});

	it("runs place_search through the core API dispatcher", async () => {
		const response: PlaceSearchResponse = [
			{
				id: "ChIJRothschild",
				street: "28 Rothschild Avenue",
				city: "Rosebery",
				country: "Australia",
				latitude: -33.9172075,
				longitude: 151.1985883,
			},
		];

		const result = await coreApi(
			{
				service: EVY_CORE_SERVICE,
				method: "place_search",
				data: {
					input: "28 Rothschild",
					language: "en-US",
					region: "au",
				},
			},
			db,
			makeCoreApiDeps({ placeSearchResponse: response }),
		);

		expect(result).toEqual(response);
	});
});
