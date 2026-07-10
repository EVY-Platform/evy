import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type {
	PlaceSearchRequest,
	PlaceSearchResponse,
	SyncRequest,
	SyncResponse,
} from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import type { EvyDb } from "../database/db";
import { coreApi } from "../procedures/coreApi";
import * as placeSearchProcedure from "../procedures/placeSearch";
import * as syncProcedure from "../procedures/sync";

const db = null as unknown as EvyDb;
const EPOCH = "1970-01-01T00:00:00.000Z";

let syncImpl = async (_params: SyncRequest): Promise<SyncResponse> => ({
	data: [],
});
let placeSearchImpl = async (
	_params: PlaceSearchRequest,
): Promise<PlaceSearchResponse> => [];

describe("coreApi", () => {
	let syncSpy: ReturnType<typeof spyOn>;
	let placeSearchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		syncSpy = spyOn(syncProcedure, "sync").mockImplementation((params) =>
			syncImpl(params),
		);
		placeSearchSpy = spyOn(
			placeSearchProcedure,
			"placeSearch",
		).mockImplementation((params) => placeSearchImpl(params));
	});

	afterEach(() => {
		syncSpy.mockRestore();
		placeSearchSpy.mockRestore();
	});

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

		syncImpl = async (params) => {
			expect(params.lastSyncTime).toBe(EPOCH);
			return response;
		};

		const result = await coreApi(
			{
				service: EVY_CORE_SERVICE,
				method: "sync",
				data: { lastSyncTime: EPOCH },
			},
			db,
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

		placeSearchImpl = async (params) => {
			expect(params).toEqual({
				input: "28 Rothschild",
			});
			return response;
		};

		const result = await coreApi(
			{
				service: EVY_CORE_SERVICE,
				method: "place_search",
				data: {
					input: "28 Rothschild",
				},
			},
			db,
		);

		expect(result).toEqual(response);
	});
});
