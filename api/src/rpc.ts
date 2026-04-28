import type {
	ApiRequest,
	GetRequest,
	GetResponse,
	SyncServiceDataResponse,
	UpsertResponse,
} from "evy-types";
import {
	getCoreForValidatedRequest,
	upsertCoreForValidatedRequest,
} from "./data";
import { syncServiceData as syncServiceDataBody } from "./serviceDataSync";
import { forwardGet, forwardUpsert, wireGrpcClientsTo } from "./services";
import {
	validateStrictApiRequest,
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import { emitJsonRpc, type RpcServer } from "./ws";

let mainServerRef: RpcServer | null = null;

export function wireServerEvents(server: RpcServer): void {
	mainServerRef = server;
	wireGrpcClientsTo(server);
}

type GetLikeRequest = GetRequest | ApiRequest;

function isCoreGetRequest(
	params: GetLikeRequest,
): params is GetRequest & { service: "evy" } {
	return params.service === "evy";
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
	if (params.service === "evy") {
		const result = await upsertCoreForValidatedRequest(params);
		if (mainServerRef) {
			emitJsonRpc(
				mainServerRef,
				params.resource === "sdui" ? "flowUpdated" : "dataUpdated",
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
