import { describe, expect, it } from "bun:test";
import type { SyncRequest, SyncResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import type { EvyDb } from "../database/db";
import { coreApi } from "../procedures/coreApi";

const db = null as unknown as EvyDb;
const EPOCH = "1970-01-01T00:00:00.000Z";

function makeSyncDeps(response: SyncResponse = { data: [] }) {
	return {
		sync: async (params: SyncRequest) => {
			expect(params.lastSyncTime).toBe(EPOCH);
			return response;
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
			makeSyncDeps(response),
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
				makeSyncDeps(),
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
				makeSyncDeps(),
			),
		).rejects.toThrow("SyncRequest validation failed");
	});
});
