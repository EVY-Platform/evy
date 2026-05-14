import type {
	ApiRequest,
	GetRequest,
	GetResponse,
	SyncResponse,
	UpsertResponse,
} from "evy-types";
import { get as getCore, upsert as upsertCore } from "./data";
import { sync as coreSync } from "./sync";
import { forwardGet, forwardUpsert } from "./services";
import {
	validateStrictApiRequest,
	validateStrictGetRequest,
	validateStrictUpsertRequest,
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

export async function upsert(params: unknown): Promise<UpsertResponse> {
	validateStrictUpsertRequest(params);
	if (params.service === EVY_CORE_SERVICE) {
		return upsertCore(params);
	}
	return forwardUpsert(params.service, params);
}

export async function sync(params: unknown): Promise<SyncResponse> {
	return coreSync(params);
}
