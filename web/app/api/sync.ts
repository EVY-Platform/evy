import type { SyncResponse, UI_Flow as ServerFlow } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { isServerFlow, wsClient } from "./wsClient";

export type ServiceResource = {
	id: string;
	fkServiceId: string;
	name: string;
};

export type ResourceAttributeMetadata = {
	serviceId: string;
	resourceId: string;
	attributeNames: string[];
};

const MAX_ATTRIBUTE_DEPTH = 5;

function extractSduiFlows(response: SyncResponse): ServerFlow[] {
	const sduiRow = response.data.find(
		(row) => row.service === EVY_CORE_SERVICE && row.resource === "sdui",
	);

	const value = sduiRow?.value;
	if (!Array.isArray(value)) {
		return [];
	}

	if (!value.every(isServerFlow)) {
		throw new Error("Invalid flows in sync response");
	}

	return value;
}

function isServiceResource(item: unknown): item is ServiceResource {
	if (typeof item !== "object" || item === null) {
		return false;
	}

	const record = item as Record<string, unknown>;
	return (
		typeof record.id === "string" &&
		typeof record.fkServiceId === "string" &&
		typeof record.name === "string"
	);
}

function extractServiceResources(response: SyncResponse): ServiceResource[] {
	const row = response.data.find(
		(row) =>
			row.service === EVY_CORE_SERVICE && row.resource === "serviceResources",
	);
	if (!Array.isArray(row?.value)) return [];
	return (row.value as unknown[]).filter(isServiceResource);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addAttributeNames(
	value: unknown,
	attributeNames: Set<string>,
	prefix = "",
	depth = 0,
) {
	if (!isRecord(value) || depth >= MAX_ATTRIBUTE_DEPTH) return;

	for (const [key, nestedValue] of Object.entries(value)) {
		if (!key.trim()) continue;

		const attributeName = prefix ? `${prefix}.${key}` : key;
		attributeNames.add(attributeName);

		if (isRecord(nestedValue)) {
			addAttributeNames(nestedValue, attributeNames, attributeName, depth + 1);
		}
	}
}

function extractResourceAttributeMetadata(
	response: SyncResponse,
): ResourceAttributeMetadata[] {
	return response.data
		.filter(
			(row) => row.service !== EVY_CORE_SERVICE && Array.isArray(row.value),
		)
		.map((row) => {
			const attributeNames = new Set<string>();
			for (const item of row.value as unknown[]) {
				addAttributeNames(item, attributeNames);
			}
			return {
				serviceId: row.service,
				resourceId: row.resource,
				attributeNames: [...attributeNames].toSorted((a, b) =>
					a.localeCompare(b),
				),
			};
		})
		.filter((metadata) => metadata.attributeNames.length > 0);
}

const EPOCH = "1970-01-01T00:00:00.000Z";

export async function syncWebData(): Promise<{
	flows: ServerFlow[];
	serviceResources: ServiceResource[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
}> {
	const response = await wsClient.sync(EPOCH);
	return {
		flows: extractSduiFlows(response),
		serviceResources: extractServiceResources(response),
		resourceAttributeMetadata: extractResourceAttributeMetadata(response),
	};
}
