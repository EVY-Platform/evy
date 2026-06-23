import type { ApiRequest } from "./generated/ts/rpc/api.request";
import type { CreateRequest } from "./generated/ts/rpc/create.request";
import type { DeleteRequest } from "./generated/ts/rpc/delete.request";
import type { GetRequest } from "./generated/ts/rpc/get.request";
import type { UpdateRequest } from "./generated/ts/rpc/update.request";
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
function assertRpcParamsCommon(params: unknown): asserts params is Record<
	string,
	unknown
> & {
	service: string;
	resource: string;
} {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
	if (
		!("service" in params) ||
		typeof params.service !== "string" ||
		params.service.length === 0
	) {
		throw new Error("Invalid or missing service");
	}
	if (
		!("resource" in params) ||
		typeof params.resource !== "string" ||
		params.resource.length === 0 ||
		params.resource.length > 50
	) {
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

export function validateStrictGetRequest(
	params: unknown,
): asserts params is GetRequest {
	assertRpcParamsCommon(params);
	validateGetRequest(params);
}

export function validateStrictApiRequest(
	params: unknown,
): asserts params is ApiRequest {
	assertRpcParamsCommon(params);
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
