import type {
	ApiRequest,
	PlaceSearchRequest,
	PlaceSearchResponse,
	SyncResponse,
} from "evy-types";
import {
	validatePlaceSearchRequest,
	validatePlaceSearchResponse,
	validateSync,
	validateSyncResponse,
} from "evy-types/validators";
import type { EvyDb } from "../database/db";
import * as placeSearchProcedure from "./placeSearch";
import * as syncProcedure from "./sync";

type CoreApiHandler = (params: ApiRequest, db: EvyDb) => Promise<unknown>;

const coreApiHandlers: Record<string, CoreApiHandler> = {
	sync: async (params, db) => {
		const syncParams = validateSync(params.data);
		const response: SyncResponse = await syncProcedure.sync(syncParams, db);
		return validateSyncResponse(response);
	},
	place_search: async (params) => {
		const placeSearchParams: PlaceSearchRequest =
			validatePlaceSearchRequest(params.data);
		const response: PlaceSearchResponse =
			await placeSearchProcedure.placeSearch(placeSearchParams);
		return validatePlaceSearchResponse(response);
	},
};

export async function coreApi(params: ApiRequest, db: EvyDb): Promise<unknown> {
	const handler = coreApiHandlers[params.method];
	if (!handler) {
		throw new Error(`Unknown evy API method: ${params.method}`);
	}
	return handler(params, db);
}
