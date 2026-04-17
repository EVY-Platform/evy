import type {
	DATA_EVY_Rows,
	GetRequest,
	GetResponse,
	UpsertRequest,
} from "evy-types";
import { NAMESPACE_VALUES } from "evy-types";
import { getCore, isResource, upsertCore } from "./data";
import { forwardGet, forwardUpsert, wireGrpcClientsTo } from "./services";
import { emitJsonRpc, type RpcServer } from "./ws";

let mainServerRef: RpcServer | null = null;

export function wireServerEvents(server: RpcServer): void {
	mainServerRef = server;
	wireGrpcClientsTo(server);
}

function validateRpcParams(
	params: unknown,
): asserts params is GetRequest | UpsertRequest {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
	if (
		!("namespace" in params) ||
		typeof params.namespace !== "string" ||
		!NAMESPACE_VALUES.includes(params.namespace as GetRequest["namespace"])
	) {
		throw new Error("Invalid or missing namespace");
	}
	if (!("resource" in params) || !isResource(params.resource)) {
		throw new Error("Invalid or missing resource");
	}
	if (
		"filter" in params &&
		params.filter !== undefined &&
		(typeof params.filter !== "object" || params.filter === null)
	) {
		throw new Error("filter must be an object");
	}
}

function assertUpsertShape(
	params: GetRequest | UpsertRequest,
): asserts params is UpsertRequest {
	if (
		!("data" in params) ||
		params.data === undefined ||
		typeof params.data !== "object" ||
		params.data === null
	) {
		throw new Error("data is required and must be a non-null object");
	}
}

export async function get(params: unknown): Promise<GetResponse> {
	validateRpcParams(params);
	if (params.namespace === "evy") {
		return getCore(params);
	}
	return forwardGet(params.namespace, params);
}

export async function upsert(params: unknown): Promise<DATA_EVY_Rows> {
	validateRpcParams(params);
	assertUpsertShape(params);
	if (params.namespace === "evy") {
		const result = await upsertCore(params);
		if (mainServerRef) {
			emitJsonRpc(
				mainServerRef,
				params.resource === "sdui" ? "flowUpdated" : "dataUpdated",
				result,
			);
		}
		return result;
	}
	return forwardUpsert(params.namespace, params);
}
