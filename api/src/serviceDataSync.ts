import pluralize from "pluralize";
import type { GetRequest, SyncServiceDataResponse, UI_Flow } from "evy-types";
import { RESOURCES_BY_SERVICE } from "evy-types";
import { validateStrictSyncServiceDataRequest } from "evy-types/rpcRequestHelpers";
import { validateSyncServiceDataResponse } from "evy-types/validators";
import {
	extractBindingsFromString,
	extractCandidatesFromBinding,
} from "./expressionParser";
import { forwardUnary } from "./services";

type SyncableService = Exclude<keyof typeof RESOURCES_BY_SERVICE, "evy">;

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
	const trimmedCandidate = candidate.trim();
	if (!trimmedCandidate) {
		return null;
	}

	const candidateVariants = [
		trimmedCandidate,
		pluralize.plural(trimmedCandidate),
	];

	for (const serviceName of SYNCABLE_SERVICES) {
		const resources = RESOURCES_BY_SERVICE[serviceName] as readonly string[];
		for (const candidateVariant of candidateVariants) {
			if (resources.includes(candidateVariant)) {
				return serviceName;
			}
		}
	}

	return null;
}

export async function syncServiceData(
	params: unknown,
): Promise<SyncServiceDataResponse> {
	validateStrictSyncServiceDataRequest(params);

	if (params.service !== "marketplace") {
		throw new Error(`Invalid or unsupported service ${params.service}`);
	}

	const serviceName = params.service;
	const resources = RESOURCES_BY_SERVICE.marketplace;

	const data: SyncServiceDataResponse["data"] = [];
	for (const resource of resources) {
		const request: GetRequest = {
			service: serviceName,
			resource,
			filter: {
				updatedAfter: params.lastSyncTime,
			},
		};

		const value = await forwardUnary(serviceName, "get", request);
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
