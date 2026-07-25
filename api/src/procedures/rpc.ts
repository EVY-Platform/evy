import type {
	CreateResponse,
	DeleteResponse,
	GetResponse,
	UpdateResponse,
} from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	validateStrictApiRequest,
	validateStrictCreateRequest,
	validateStrictDeleteRequest,
	validateStrictGetRequest,
	validateStrictUpdateRequest,
} from "evy-types/rpcRequestHelpers";
import {
	create as createCore,
	deleteResource as deleteCore,
	get as getCore,
	update as updateCore,
} from "../data/data";
import type { EvyDb } from "../database/db";
import { coreApi } from "./coreApi";
import {
	forwardCreate,
	forwardDelete,
	forwardGet,
	forwardUpdate,
} from "./services";

export async function get(params: unknown, db: EvyDb): Promise<GetResponse> {
	validateStrictGetRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return getCore(db, params);
	}
	return forwardGet(params.service, params);
}

export async function api(params: unknown, db: EvyDb): Promise<unknown> {
	validateStrictApiRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return coreApi(params, db);
	}
	throw new Error(
		`API calls are only supported for the evy core service ${EVY_CORE_SERVICE} (got "${params.service}")`,
	);
}

export async function create(
	params: unknown,
	db: EvyDb,
): Promise<CreateResponse> {
	validateStrictCreateRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return createCore(db, params);
	}
	return forwardCreate(params.service, params);
}

export async function update(
	params: unknown,
	db: EvyDb,
): Promise<UpdateResponse> {
	validateStrictUpdateRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return updateCore(db, params);
	}
	return forwardUpdate(params.service, params);
}

export async function deleteResource(
	params: unknown,
	db: EvyDb,
): Promise<DeleteResponse> {
	validateStrictDeleteRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return deleteCore(db, params);
	}
	return forwardDelete(params.service, params);
}
