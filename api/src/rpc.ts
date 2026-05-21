import type {
	ApiRequest,
	GetRequest,
	GetResponse,
	SyncResponse,
	CreateResponse,
	UpdateResponse,
} from "evy-types";
import {
	get as getCore,
	create as createCore,
	update as updateCore,
} from "./data";
import { sync as coreSync } from "./sync";
import { forwardGet, forwardCreate, forwardUpdate } from "./services";
import {
	validateStrictApiRequest,
	validateStrictGetRequest,
	validateStrictCreateRequest,
	validateStrictUpdateRequest,
} from "evy-types/rpcRequestHelpers";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";

type GetLikeRequest = GetRequest | ApiRequest;

function isCoreGetRequest(
	params: GetLikeRequest,
): params is GetRequest & { service: "evy" } {
	return params.service === EVY_CORE_SERVICE;
}

async function handleGetRequest<T extends GetLikeRequest>(
	validate: (p: unknown) => asserts p is T,
	params: unknown,
): Promise<GetResponse> {
	validate(params);
	if (isCoreGetRequest(params)) {
		return getCore(params);
	}
	return forwardGet(params.service, params);
}

export async function get(params: unknown): Promise<GetResponse> {
	return handleGetRequest(validateStrictGetRequest, params);
}

export async function api(params: unknown): Promise<GetResponse> {
	return handleGetRequest(validateStrictApiRequest, params);
}

export async function create(params: unknown): Promise<CreateResponse> {
	validateStrictCreateRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return createCore(params);
	}
	return forwardCreate(params.service, params);
}

export async function update(params: unknown): Promise<UpdateResponse> {
	validateStrictUpdateRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return updateCore(params);
	}
	return forwardUpdate(params.service, params);
}

export async function sync(params: unknown): Promise<SyncResponse> {
	return coreSync(params);
}
