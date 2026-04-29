import type {
	GetRequest,
	GetResponse,
	SyncServiceDataResponse,
	UI_Flow,
} from "evy-types";
import { RESOURCES_BY_SERVICE } from "evy-types";
import { validateStrictSyncServiceDataRequest } from "evy-types/rpcRequestHelpers";
import { validateSyncServiceDataResponse } from "evy-types/validators";
import {
	extractBindingsFromString,
	extractCandidatesFromBinding,
} from "./expressionParser";
import { forwardGet } from "./services";

type SyncableService = Exclude<keyof typeof RESOURCES_BY_SERVICE, "evy">;

type SyncServiceDataDependencies = {
	forwardGet: (serviceName: string, params: GetRequest) => Promise<GetResponse>;
};

const DEFAULT_SYNC_SERVICE_DATA_DEPENDENCIES: SyncServiceDataDependencies = {
	forwardGet,
};

const SYNCABLE_SERVICES = Object.keys(RESOURCES_BY_SERVICE).filter(
	(serviceName) => serviceName !== "evy",
) as SyncableService[];

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

export function resolveCandidateToService(candidate: string): string | null {
	if (!candidate) {
		return null;
	}

	for (const serviceName of SYNCABLE_SERVICES) {
		const resources = RESOURCES_BY_SERVICE[serviceName] as readonly string[];
		if (resources.includes(candidate)) {
			return serviceName;
		}
	}

	return null;
}

async function syncAllResources(
	serviceName: SyncableService,
	lastSyncTime: string,
	dependencies: SyncServiceDataDependencies,
): Promise<SyncServiceDataResponse> {
	const resources = RESOURCES_BY_SERVICE[serviceName];

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
