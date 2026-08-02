import type { ApiRequest, SyncResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { proceduresForService } from "evy-types/procedures";
import {
	validateChargeRequest,
	validateChargeResponse,
	validatePlaceSearchRequest,
	validatePlaceSearchResponse,
	validateSyncRequest,
	validateSyncResponse,
} from "evy-types/validators";
import type { EvyDb } from "../database/db";
import * as chargeProcedure from "./charge";
import * as placeSearchProcedure from "./placeSearch";
import * as syncProcedure from "./sync";

/**
 * A procedure the gateway runs itself.
 *
 * Takes the raw request payload and is responsible for validating it and its
 * own response: the request because the caller is untrusted, the response
 * because a procedure that drifts from its declared schema breaks clients
 * silently rather than here.
 */
type CoreProcedure = (data: unknown, db: EvyDb) => Promise<unknown>;

async function runSync(params: unknown, db: EvyDb): Promise<SyncResponse> {
	const request = validateSyncRequest(params ?? {});
	return validateSyncResponse(await syncProcedure.sync(request, db));
}

const coreProcedures: Record<string, CoreProcedure> = {
	charge: async (data, db) =>
		validateChargeResponse(
			await chargeProcedure.charge(validateChargeRequest(data), db),
		),
	place_search: async (data) =>
		validatePlaceSearchResponse(
			await placeSearchProcedure.placeSearch(
				validatePlaceSearchRequest(data),
			),
		),
};

/**
 * The registry decides what exists; this file decides what it does. If the two
 * disagree a procedure is either declared and unreachable or reachable and
 * undeclared - the second means it bypassed the registry contract entirely, so
 * fail at load rather than serve it.
 */
export function assertHandlersMatchRegistry(
	declaredNames: readonly string[],
	implementedNames: readonly string[],
): void {
	const declared = new Set(declaredNames);
	const implemented = new Set(implementedNames);

	const missing = [...declared].filter((name) => !implemented.has(name));
	const undeclared = [...implemented].filter((name) => !declared.has(name));

	if (missing.length > 0 || undeclared.length > 0) {
		throw new Error(
			"Core procedure handlers do not match the registry" +
				(missing.length > 0
					? `; declared without a handler: ${missing.join(", ")}`
					: "") +
				(undeclared.length > 0
					? `; handled but not declared in types/schema/resources/procedures.json: ${undeclared.join(", ")}`
					: ""),
		);
	}
}

assertHandlersMatchRegistry(
	proceduresForService(EVY_CORE_SERVICE),
	Object.keys(coreProcedures),
);

/** Top-level `sync` JSON-RPC method. */
export const syncMethod = runSync;

export async function coreApi(params: ApiRequest, db: EvyDb): Promise<unknown> {
	const procedure = coreProcedures[params.method];
	if (!procedure) {
		throw new Error(`Unknown evy API method: ${params.method}`);
	}

	return procedure(params.data, db);
}
