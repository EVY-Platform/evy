import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	SyncResponse,
} from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import type { FlowEntityCollections } from "../utils/flowEntities";
import { wsClient } from "./wsClient";

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

function extractFlatResourceRows<T>(
	response: SyncResponse,
	resource: string,
	guard: (item: unknown) => item is T,
): T[] {
	const row = response.data.find(
		(row) => row.service === EVY_CORE_SERVICE && row.resource === resource,
	);
	if (!Array.isArray(row?.value)) return [];
	if (!row.value.every(guard)) {
		throw new Error(`Invalid ${resource} in sync response`);
	}
	return row.value;
}

function extractFlowEntityCollections(
	response: SyncResponse,
): FlowEntityCollections {
	return {
		flows: extractFlatResourceRows(
			response,
			EVY_CORE_RESOURCE.FLOWS,
			isDataEvyFlow,
		),
		pages: extractFlatResourceRows(
			response,
			EVY_CORE_RESOURCE.PAGES,
			isDataEvyPage,
		),
		rows: extractFlatResourceRows(
			response,
			EVY_CORE_RESOURCE.ROWS,
			isDataEvyRow,
		),
	};
}

function isDataEvyFlow(item: unknown): item is DATA_EVY_Flow {
	if (!isRecord(item)) return false;
	return (
		typeof item.id === "string" &&
		typeof item.name === "string" &&
		Array.isArray(item.pageIds)
	);
}

function isDataEvyPage(item: unknown): item is DATA_EVY_Page {
	if (!isRecord(item)) return false;
	return (
		typeof item.id === "string" &&
		typeof item.name === "string" &&
		Array.isArray(item.rowIds)
	);
}

function isDataEvyRow(item: unknown): item is DATA_EVY_Row {
	if (!isRecord(item)) return false;
	return (
		typeof item.id === "string" &&
		typeof item.name === "string" &&
		typeof item.type === "string" &&
		typeof item.visible === "string" &&
		isRecord(item.data)
	);
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
			row.service === EVY_CORE_SERVICE &&
			row.resource === EVY_CORE_RESOURCE.SERVICE_RESOURCES,
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
			addAttributeNames(
				nestedValue,
				attributeNames,
				attributeName,
				depth + 1,
			);
		}
	}
}

function extractResourceAttributeMetadata(
	response: SyncResponse,
): ResourceAttributeMetadata[] {
	return response.data
		.filter(
			(row) =>
				row.service !== EVY_CORE_SERVICE && Array.isArray(row.value),
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
	flowGraph: FlowEntityCollections;
	serviceResources: ServiceResource[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
}> {
	const response = await wsClient.sync(EPOCH);
	return {
		flowGraph: extractFlowEntityCollections(response),
		serviceResources: extractServiceResources(response),
		resourceAttributeMetadata: extractResourceAttributeMetadata(response),
	};
}
