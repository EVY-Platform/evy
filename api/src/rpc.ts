import type {
	ApiRequest,
	GetRequest,
	GetResponse,
	SyncServiceDataResponse,
	UpsertResponse,
} from "evy-types";
import type { BroadcastFn } from "./broadcast";
import {
	getCoreForValidatedRequest,
	upsertCoreForValidatedRequest,
} from "./data";
import { syncServiceData as syncServiceDataBody } from "./serviceDataSync";
import { forwardGet, forwardUpsert } from "./services";
import {
	validateStrictApiRequest,
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import { EVY_CORE_SERVICE, EVY_CORE_RESOURCE } from "evy-types/coreResources";

let broadcast: BroadcastFn | null = null;

export function initRpc(broadcastFn: BroadcastFn): void {
	broadcast = broadcastFn;
}

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
		return getCoreForValidatedRequest(params);
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
		const result = await upsertCoreForValidatedRequest(params);
		if (broadcast) {
			broadcast(
				params.resource === EVY_CORE_RESOURCE.SDUI
					? "flowUpdated"
					: "dataUpdated",
				result,
			);
		}
		return result;
	}
	return forwardUpsert(params.service, params);
}

export async function syncServiceData(
	params: unknown,
): Promise<SyncServiceDataResponse> {
	return syncServiceDataBody(params);
}
