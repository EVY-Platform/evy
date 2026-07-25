import type { ApiRequest, SyncResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { PROCEDURES, proceduresForService } from "evy-types/procedures";
import {
	validatePlaceSearchRequest,
	validatePlaceSearchResponse,
	validateSyncRequest,
	validateSyncResponse,
} from "evy-types/validators";
import type { EvyDb } from "../database/db";
import * as placeSearchProcedure from "./placeSearch";
import { rateLimiter } from "./rateLimit";
import * as syncProcedure from "./sync";

/**
 * A procedure the gateway runs itself.
 *
 * Request and response are both validated: the request because the caller is
 * untrusted, the response because a procedure that drifts from its declared
 * schema breaks clients silently rather than here.
 */
interface CoreProcedure {
	validateRequest: (data: unknown) => unknown;
	validateResponse: (data: unknown) => unknown;
	run: (data: never, db: EvyDb) => Promise<unknown>;
}

const coreProcedures: Record<string, CoreProcedure> = {
	sync: {
		validateRequest: (data) => validateSyncRequest(data ?? {}),
		validateResponse: validateSyncResponse,
		run: (data, db) => syncProcedure.sync(data, db),
	},
	place_search: {
		validateRequest: validatePlaceSearchRequest,
		validateResponse: validatePlaceSearchResponse,
		run: (data) => placeSearchProcedure.placeSearch(data),
	},
};

/**
 * The registry decides what exists; this file decides what it does. If the two
 * disagree a procedure is either declared and unreachable or reachable and
 * undeclared - the second means it skipped rate limiting, so fail at load
 * rather than serve it.
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

/** Top-level `sync` RPC. Also reachable as api{method:"sync"} for older clients. */
export async function syncMethod(
	params: unknown,
	db: EvyDb,
): Promise<SyncResponse> {
	const syncParams = validateSyncRequest(params ?? {});
	const response: SyncResponse = await syncProcedure.sync(syncParams, db);
	return validateSyncResponse(response);
}

export async function coreApi(
	params: ApiRequest,
	db: EvyDb,
	callerId = "anonymous",
): Promise<unknown> {
	const procedure = coreProcedures[params.method];
	if (!procedure) {
		throw new Error(`Unknown evy API method: ${params.method}`);
	}

	rateLimiter.consume(
		callerId,
		params.method,
		PROCEDURES[params.method].perMinute,
	);

	const request = procedure.validateRequest(params.data) as never;
	const response = await procedure.run(request, db);
	return procedure.validateResponse(response);
}
