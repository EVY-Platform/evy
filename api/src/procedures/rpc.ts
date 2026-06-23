import type {
	ApiRequest,
	CreateResponse,
	DeleteResponse,
	GetRequest,
	GetResponse,
	SyncResponse,
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
import { forwardCreate, forwardGet, forwardUpdate } from "./services";
import { sync as coreSync } from "./sync";

type GetLikeRequest = GetRequest | ApiRequest;

async function handleGetRequest<T extends GetLikeRequest>(
	validate: (p: unknown) => asserts p is T,
	params: unknown,
	db: EvyDb,
): Promise<GetResponse> {
	validate(params);
	if (params.service === EVY_CORE_SERVICE) {
		return getCore(db, params);
	}
	return forwardGet(params.service, params);
}

export async function get(params: unknown, db: EvyDb): Promise<GetResponse> {
	return handleGetRequest(validateStrictGetRequest, params, db);
}

export async function api(params: unknown, db: EvyDb): Promise<GetResponse> {
	return handleGetRequest(validateStrictApiRequest, params, db);
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
	throw new Error("Delete is only supported for evy core resources");
}

export async function sync(params: unknown, db: EvyDb): Promise<SyncResponse> {
	return coreSync(params, db);
}
