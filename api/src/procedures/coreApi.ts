import type { ApiRequest, SyncResponse } from "evy-types";
import { validateSync, validateSyncResponse } from "evy-types/validators";
import type { EvyDb } from "../database/db";
import { sync } from "./sync";

type SyncRunner = typeof sync;

type CoreApiDependencies = {
	sync: SyncRunner;
};

type CoreApiHandler = (
	params: ApiRequest,
	db: EvyDb,
	deps: CoreApiDependencies,
) => Promise<unknown>;

const defaultCoreApiDependencies: CoreApiDependencies = { sync };

const coreApiHandlers: Record<string, CoreApiHandler> = {
	sync: async (params, db, deps) => {
		const syncParams = validateSync(params.data);
		const response: SyncResponse = await deps.sync(syncParams, db);
		return validateSyncResponse(response);
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
