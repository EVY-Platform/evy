import type { ApiRequest } from "./generated/ts/rpc/api.request";
import type { GetRequest } from "./generated/ts/rpc/get.request";

import type { UpsertRequest } from "./generated/ts/rpc/upsert.request";
import {
	validateApiRequest,
	validateGetRequest,
	validateUpsertRequest,
} from "./validators";
import { EVY_CORE_SERVICE, EVY_CORE_RESOURCE_NAMES } from "./coreResources";

/**
 * Runtime registry of known service→resource mappings.
 * Populated at startup via gRPC ListResources calls by the API gateway.
 * The "evy" core service is always registered with known fixed resources.
 */
let serviceRegistry: Map<string, Set<string>> | null = null;

function ensureServiceRegistry(): Map<string, Set<string>> {
	if (!serviceRegistry) {
		serviceRegistry = new Map<string, Set<string>>();
		serviceRegistry.set(EVY_CORE_SERVICE, new Set(EVY_CORE_RESOURCE_NAMES));
	}
	return serviceRegistry;
}

/**
 * Update the service registry at runtime (e.g., after discovering services via gRPC).
 * Replaces all entries with live data from gRPC ListResources, preserving the evy core entry.
 */
export function setServiceRegistry(
	entries: Iterable<[string, string[]]>,
): void {
	const registry = new Map<string, Set<string>>();
	registry.set(EVY_CORE_SERVICE, new Set(EVY_CORE_RESOURCE_NAMES));
	for (const [svc, resources] of entries) {
		if (svc !== EVY_CORE_SERVICE) {
			registry.set(svc, new Set(resources));
		}
	}
	serviceRegistry = registry;
}

/** Returns the current set of known service names. */
export function getServiceNames(): string[] {
	return [...ensureServiceRegistry().keys()];
}

/** Returns the resources for a given service, or undefined if unknown. */
export function getServiceResources(service: string): string[] | undefined {
	const resources = ensureServiceRegistry().get(service);
	return resources ? [...resources] : undefined;
}

function isValidServiceResourcePair(
	service: string,
	resource: string,
): boolean {
	return ensureServiceRegistry().get(service)?.has(resource) ?? false;
}

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

export function validateStrictApiRequest(
	params: unknown,
): asserts params is ApiRequest {
	assertRpcParamsCommon(params);
	validateApiRequest(params);
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
