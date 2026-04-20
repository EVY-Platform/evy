import type { GetRequest } from "./generated/ts/rpc/get.request";
import {
	RESOURCES_BY_SERVICE,
	RESOURCE_VALUES,
	SERVICE_VALUES,
} from "./generated/ts/rpc/get.request";
import type { UpsertRequest } from "./generated/ts/rpc/upsert.request";
import { validateGetRequest, validateUpsertRequest } from "./validators";

type Service = GetRequest["service"];
type Resource = GetRequest["resource"];

function isService(v: unknown): v is Service {
	return typeof v === "string" && SERVICE_VALUES.includes(v as Service);
}

function isResource(v: unknown): v is Resource {
	return typeof v === "string" && RESOURCE_VALUES.includes(v as Resource);
}

function isValidServiceResourcePair(service: Service, resource: Resource): boolean {
	const allowed = RESOURCES_BY_SERVICE[service] as readonly string[];
	return allowed.includes(resource);
}

/**
 * Shared JSON-RPC param checks with stable error messages (tests rely on these strings).
 */
function assertRpcParamsCommon(params: unknown): asserts params is Record<
	string,
	unknown
> & {
	service: Service;
	resource: Resource;
} {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
	if (!("service" in params) || !isService(params.service)) {
		throw new Error("Invalid or missing service");
	}
	if (!("resource" in params) || !isResource(params.resource)) {
		throw new Error("Invalid or missing resource");
	}
	if (!isValidServiceResourcePair(params.service, params.resource)) {
		throw new Error("Invalid service and resource combination");
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

export function validateStrictUpsertRequest(
	params: unknown,
): asserts params is UpsertRequest {
	assertRpcParamsCommon(params);
	if (
		!("data" in params) ||
		params.data === undefined ||
		typeof params.data !== "object" ||
		params.data === null
	) {
		throw new Error("data is required and must be a non-null object");
	}
	validateUpsertRequest(params);
}
