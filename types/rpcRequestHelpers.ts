import type { ApiRequest } from "./generated/ts/rpc/api.request";
import type { CreateRequest } from "./generated/ts/rpc/create.request";
import type { DeleteRequest } from "./generated/ts/rpc/delete.request";
import type { GetRequest } from "./generated/ts/rpc/get.request";
import type { UpdateRequest } from "./generated/ts/rpc/update.request";
import { isValidResourceRef, isValidServiceSlug } from "./resourceRef";
import {
	validateApiRequest,
	validateCreateRequest,
	validateDeleteRequest,
	validateGetRequest,
	validateUpdateRequest,
} from "./validators";

/**
 * Shared JSON-RPC param checks with stable error messages (tests rely on these strings).
 */
type RpcParamsObject = Record<string, unknown>;

function assertRpcParamsObject(
	params: unknown,
): asserts params is RpcParamsObject {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
}

function assertRequiredService(
	params: RpcParamsObject,
): asserts params is RpcParamsObject & { service: string } {
	if (
		!("service" in params) ||
		typeof params.service !== "string" ||
		!isValidServiceSlug(params.service)
	) {
		throw new Error("Invalid or missing service");
	}
}

function assertRequiredResource(
	params: RpcParamsObject,
): asserts params is RpcParamsObject & { resource: string } {
	if (
		!("resource" in params) ||
		typeof params.resource !== "string" ||
		!isValidResourceRef(params.resource)
	) {
		throw new Error("Invalid or missing resource");
	}
}

function assertOptionalResource(params: RpcParamsObject): void {
	if (
		"resource" in params &&
		params.resource !== undefined &&
		(typeof params.resource !== "string" ||
			!isValidResourceRef(params.resource))
	) {
		throw new Error("Invalid or missing resource");
	}
}

function assertOptionalFilter(params: RpcParamsObject): void {
	if (
		"filter" in params &&
		params.filter !== undefined &&
		(typeof params.filter !== "object" || params.filter === null)
	) {
		throw new Error("filter must be an object");
	}
}

function assertRpcParamsCommon(
	params: unknown,
): asserts params is RpcParamsObject & {
	resource: string;
} {
	assertRpcParamsObject(params);
	assertRequiredResource(params);
	assertOptionalFilter(params);
}

export function validateStrictGetRequest(
	params: unknown,
): asserts params is GetRequest {
	assertRpcParamsCommon(params);
	validateGetRequest(params);
}

export function validateStrictApiRequest(
	params: unknown,
): asserts params is ApiRequest {
	assertRpcParamsObject(params);
	assertRequiredService(params);
	assertOptionalResource(params);
	assertOptionalFilter(params);
	validateApiRequest(params);
}

function assertDataField(params: Record<string, unknown>): void {
	if (
		!("data" in params) ||
		params.data === undefined ||
		typeof params.data !== "object" ||
		params.data === null
	) {
		throw new Error("data is required and must be a non-null object");
	}
}

export function validateStrictCreateRequest(
	params: unknown,
): asserts params is CreateRequest {
	assertRpcParamsCommon(params);
	assertDataField(params);
	validateCreateRequest(params);
}

function assertFilterId(
	params: Record<string, unknown>,
	operation: "update" | "delete",
): void {
	if (
		!params.filter ||
		typeof params.filter !== "object" ||
		!("id" in params.filter) ||
		typeof params.filter.id !== "string" ||
		params.filter.id.length === 0
	) {
		throw new Error(
			`filter.id is required and must be a non-empty string for ${operation}`,
		);
	}
}

export function validateStrictUpdateRequest(
	params: unknown,
): asserts params is UpdateRequest {
	assertRpcParamsCommon(params);
	assertDataField(params);
	assertFilterId(params, "update");
	validateUpdateRequest(params);
}

export function validateStrictDeleteRequest(
	params: unknown,
): asserts params is DeleteRequest {
	assertRpcParamsCommon(params);
	assertFilterId(params, "delete");
	validateDeleteRequest(params);
}
