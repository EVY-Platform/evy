import pluralize from "pluralize";
import type {
	GetRequest,
	GetResponse,
	SyncServiceDataResponse,
	UI_Flow,
} from "evy-types";
import {
	getServiceNames,
	getServiceResources,
	validateStrictSyncServiceDataRequest,
} from "evy-types/rpcRequestHelpers";
import { validateSyncServiceDataResponse } from "evy-types/validators";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	extractBindingsFromString,
	extractCandidatesFromBinding,
} from "./expressionParser";
import { forwardGet } from "./services";

type SyncServiceDataDependencies = {
	forwardGet: (serviceName: string, params: GetRequest) => Promise<GetResponse>;
};

const DEFAULT_SYNC_SERVICE_DATA_DEPENDENCIES: SyncServiceDataDependencies = {
	forwardGet,
};

/** Returns the list of syncable (non-evy) service names from the runtime registry. */
function getSyncableServices(): string[] {
	return getServiceNames().filter((name) => name !== EVY_CORE_SERVICE);
}

export function extractCandidatesFromFlows(flows: UI_Flow[]): Set<string> {
	const candidates = new Set<string>();

	for (const flow of flows) {
		collectCandidatesFromValue(flow, candidates);
	}

	return candidates;
}

export function discoverReferencedServices(flows: UI_Flow[]): Set<string> {
	const services = new Set<string>();

	for (const candidate of extractCandidatesFromFlows(flows)) {
		const serviceName = resolveCandidateToService(candidate);
		if (serviceName) {
			services.add(serviceName);
		}
	}

	return services;
}

function resourceCandidatesFor(candidate: string): string[] {
	const plural = pluralize.plural(candidate);
	const singular = pluralize.singular(candidate);
	return [...new Set([candidate, plural, singular])];
}

export function resolveCandidateToService(candidate: string): string | null {
	if (!candidate) {
		return null;
	}

	for (const serviceName of getSyncableServices()) {
		const resources = getServiceResources(serviceName) ?? [];
		for (const resourceCandidate of resourceCandidatesFor(candidate)) {
			if (resources.includes(resourceCandidate)) {
				return serviceName;
			}
		}
	}

	return null;
}

async function syncAllResources(
	serviceName: string,
	lastSyncTime: string,
	dependencies: SyncServiceDataDependencies,
): Promise<SyncServiceDataResponse> {
	const resources = getServiceResources(serviceName) ?? [];

	const data: SyncServiceDataResponse["data"] = [];
	for (const resource of resources) {
		const request: GetRequest = {
			service: serviceName,
			resource,
			filter: {
				updatedAfter: lastSyncTime,
			},
		};

		const value = await dependencies.forwardGet(serviceName, request);
		if (Array.isArray(value) && value.length === 0) {
			continue;
		}

		data.push({
			service: serviceName,
			resource,
			value,
		});
	}

	return validateSyncServiceDataResponse({ data });
}

export async function syncServiceData(
	params: unknown,
	dependencies: SyncServiceDataDependencies = DEFAULT_SYNC_SERVICE_DATA_DEPENDENCIES,
): Promise<SyncServiceDataResponse> {
	validateStrictSyncServiceDataRequest(params);

	if (params.service !== "marketplace") {
		throw new Error(`Invalid or unsupported service ${params.service}`);
	}

	return syncAllResources(params.service, params.lastSyncTime, dependencies);
}

function collectCandidatesFromValue(
	value: unknown,
	candidates: Set<string>,
): void {
	if (typeof value === "string") {
		for (const bindingBody of extractBindingsFromString(value)) {
			for (const candidate of extractCandidatesFromBinding(bindingBody)) {
				candidates.add(candidate);
			}
		}
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectCandidatesFromValue(item, candidates);
		}
		return;
	}

	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) {
			collectCandidatesFromValue(child, candidates);
		}
	}
}
