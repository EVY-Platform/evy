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
import { placeSearch } from "./placeSearch";
import { sync } from "./sync";

type SyncRunner = typeof sync;
type PlaceSearchRunner = typeof placeSearch;

export type CoreApiDependencies = {
	sync: SyncRunner;
	placeSearch: PlaceSearchRunner;
};

type CoreApiHandler = (
	params: ApiRequest,
	db: EvyDb,
	deps: CoreApiDependencies,
) => Promise<unknown>;

const defaultCoreApiDependencies: CoreApiDependencies = {
	sync,
	placeSearch,
};

const coreApiHandlers: Record<string, CoreApiHandler> = {
	sync: async (params, db, deps) => {
		const syncParams = validateSync(params.data);
		const response: SyncResponse = await deps.sync(syncParams, db);
		return validateSyncResponse(response);
	},
	place_search: async (params, _db, deps) => {
		const placeSearchParams: PlaceSearchRequest =
			validatePlaceSearchRequest(params.data);
		const response: PlaceSearchResponse =
			await deps.placeSearch(placeSearchParams);
		return validatePlaceSearchResponse(response);
	},
};

export async function coreApi(
	params: ApiRequest,
	db: EvyDb,
	deps: CoreApiDependencies = defaultCoreApiDependencies,
): Promise<unknown> {
	const handler = coreApiHandlers[params.method];
	if (!handler) {
		throw new Error(`Unknown evy API method: ${params.method}`);
	}
	return handler(params, db, deps);
}
