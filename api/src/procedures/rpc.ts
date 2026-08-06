import type {
	CreateResponse,
	DeleteResponse,
	GetResponse,
	UpdateResponse,
} from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { PROCEDURES } from "evy-types/procedures";
import { serviceOfRef } from "evy-types/resourceRef";
import {
	validateStrictApiRequest,
	validateStrictCreateRequest,
	validateStrictDeleteRequest,
	validateStrictGetRequest,
	validateStrictUpdateRequest,
} from "evy-types/rpcRequestHelpers";
import { assertCoreResourceMutable } from "../data/catalogVisibility";
import {
	deleteResource as deleteCore,
	get as getCore,
	update as updateCore,
} from "../data/data";
import type { EvyDb } from "../database/db";
import { coreApi } from "./coreApi";
import { hookedCreate } from "./hooks";
import {
	forwardApi,
	forwardCreate,
	forwardDelete,
	forwardGet,
	forwardUpdate,
} from "./services";

export async function get(params: unknown, db: EvyDb): Promise<GetResponse> {
	validateStrictGetRequest(params);
	const service = serviceOfRef(params.resource);
	if (service === EVY_CORE_SERVICE) {
		return getCore(db, params);
	}
	return forwardGet(service, params);
}

export async function api(params: unknown, db: EvyDb): Promise<unknown> {
	validateStrictApiRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return coreApi(params, db);
	}

	// A service can only be sent procedures the registry says it owns. Without
	// that check the gateway would relay any method name to any service and the
	// wire contract would be whatever the two ends happened to agree on.
	const declared = PROCEDURES[params.method];
	if (!declared || declared.service !== params.service) {
		throw new Error(
			`Procedure "${params.method}" is not declared for service "${params.service}" in types/schema/resources/procedures.json`,
		);
	}

	return forwardApi(params.service, params);
}

export async function create(
	params: unknown,
	db: EvyDb,
): Promise<CreateResponse> {
	validateStrictCreateRequest(params);
	const service = serviceOfRef(params.resource);
	if (service === EVY_CORE_SERVICE) {
		assertCoreResourceMutable(params.resource);
		return hookedCreate(db, params);
	}
	return forwardCreate(service, params);
}

export async function update(
	params: unknown,
	db: EvyDb,
): Promise<UpdateResponse> {
	validateStrictUpdateRequest(params);
	const service = serviceOfRef(params.resource);
	if (service === EVY_CORE_SERVICE) {
		assertCoreResourceMutable(params.resource);
		return updateCore(db, params);
	}
	return forwardUpdate(service, params);
}

export async function deleteResource(
	params: unknown,
	db: EvyDb,
): Promise<DeleteResponse> {
	validateStrictDeleteRequest(params);
	const service = serviceOfRef(params.resource);
	if (service === EVY_CORE_SERVICE) {
		assertCoreResourceMutable(params.resource);
		return deleteCore(db, params);
	}
	return forwardDelete(service, params);
}
