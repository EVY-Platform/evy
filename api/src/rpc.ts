import type {
	GetResponse,
	SyncServiceDataResponse,
	UpsertResponse,
} from "evy-types";
import {
	getCoreForValidatedRequest,
	upsertCoreForValidatedRequest,
} from "./data";
import { syncServiceData as syncServiceDataBody } from "./serviceDataSync";
import { forwardUnary, wireGrpcClientsTo } from "./services";
import {
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import { emitJsonRpc, type RpcServer } from "./ws";

let mainServerRef: RpcServer | null = null;

export function wireServerEvents(server: RpcServer): void {
	mainServerRef = server;
	wireGrpcClientsTo(server);
}

export async function get(params: unknown): Promise<GetResponse> {
	validateStrictGetRequest(params);
	if (params.service === "evy") {
		return getCoreForValidatedRequest(params);
	}
	return forwardUnary(params.service, "get", params);
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
	return forwardUnary(params.service, "upsert", params);
}

export async function syncServiceData(
	params: unknown,
): Promise<SyncServiceDataResponse> {
	return syncServiceDataBody(params);
}
