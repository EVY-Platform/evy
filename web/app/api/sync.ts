import type {
	DATA_EVY_Flow,
	DATA_EVY_Formatter,
	DATA_EVY_Page,
	DATA_EVY_Row,
	ResourcesResponse,
	SyncResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import {
	validateDataEvyFlow,
	validateDataEvyFormatter,
	validateDataEvyPage,
	validateDataEvyRow,
	validateResourcesResponse,
} from "evy-types/validators";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../types/resources";
import type { FlowEntityCollections } from "../utils/flowEntities";
import { wsClient } from "./wsClient";

const MAX_ATTRIBUTE_DEPTH = 5;

function flattenServiceResources(
	response: ResourcesResponse,
): ServiceResource[] {
	return response.services.flatMap((service) =>
		service.resources.map((resource) => ({
			id: resource.id,
			serviceId: service.id,
			name: resource.name,
		})),
	);
}

function serviceNamesById(response: ResourcesResponse): Map<string, string> {
	return new Map(
		response.services.map((service) => [service.id, service.name]),
	);
}

function extractFlatResourceRows<T>(
	response: SyncResponse,
	resourceRef: string,
	guard: (item: unknown) => item is T,
): T[] {
	const row = response.data.find((row) => row.resource === resourceRef);
	if (!Array.isArray(row?.value)) return [];
	if (!row.value.every(guard)) {
		throw new Error(`Invalid ${resourceRef} in sync response`);
	}
	return row.value;
}

function extractFlowEntityCollections(
	response: SyncResponse,
): FlowEntityCollections {
	return {
		flows: extractFlatResourceRows(
			response,
			EVY_CORE_RESOURCE_REF.FLOWS,
			isDataEvyFlow,
		),
		pages: extractFlatResourceRows(
			response,
			EVY_CORE_RESOURCE_REF.PAGES,
			isDataEvyPage,
		),
		rows: extractFlatResourceRows(
			response,
			EVY_CORE_RESOURCE_REF.ROWS,
			isDataEvyRow,
		),
	};
}

function isValid<T>(validate: (value: unknown) => T, item: unknown): item is T {
	try {
		validate(item);
		return true;
	} catch {
		return false;
	}
}

function isDataEvyFlow(item: unknown): item is DATA_EVY_Flow {
	return isValid(validateDataEvyFlow, item);
}

function isDataEvyPage(item: unknown): item is DATA_EVY_Page {
	return isValid(validateDataEvyPage, item);
}

function isDataEvyRow(item: unknown): item is DATA_EVY_Row {
	return isValid(validateDataEvyRow, item);
}

function isDataEvyFormatter(item: unknown): item is DATA_EVY_Formatter {
	return isValid(validateDataEvyFormatter, item);
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

function inferAttributeNames(
	response: SyncResponse,
	resourceRef: string,
): string[] {
	const attributeNames = new Set<string>();
	for (const row of response.data) {
		if (row.resource !== resourceRef) continue;
		if (!Array.isArray(row.value)) continue;
		for (const item of row.value) {
			addAttributeNames(item, attributeNames);
		}
	}
	return [...attributeNames].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Bindable attribute names per service resource.
 *
 * A service that declares `attributes` on its manifest is taken at its word:
 * it knows its own schema, so the list is right even for a resource nobody has
 * created a row in yet. Services that declare nothing fall back to reading the
 * keys off whatever rows synced, which is what every service used to get.
 */
export function extractResourceAttributeMetadata(
	catalog: ResourcesResponse,
	response: SyncResponse,
): ResourceAttributeMetadata[] {
	return catalog.services
		.filter((service) => service.id !== EVY_CORE_SERVICE)
		.flatMap((service) =>
			service.resources.map((resource) => ({
				serviceId: service.id,
				resourceId: resource.id,
				attributeNames:
					resource.attributes && resource.attributes.length > 0
						? [...resource.attributes].toSorted((a, b) =>
								a.localeCompare(b),
							)
						: inferAttributeNames(response, resource.id),
			})),
		)
		.filter((metadata) => metadata.attributeNames.length > 0);
}

function extractResourceCatalog(
	response: SyncResponse,
): ResourcesResponse | undefined {
	const row = response.data.find(
		(entry) => entry.resource === EVY_CORE_RESOURCE_REF.RESOURCES,
	);
	if (
		!row?.value ||
		typeof row.value !== "object" ||
		Array.isArray(row.value)
	) {
		return undefined;
	}
	return validateResourcesResponse(row.value);
}

export async function syncWebData(): Promise<{
	flowGraph: FlowEntityCollections;
	serviceResources: ServiceResource[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
	serviceNamesById: Map<string, string>;
	formatters: DATA_EVY_Formatter[];
}> {
	const syncResponse = await wsClient.sync();

	if (syncResponse.errors?.length) {
		console.warn(
			"sync was incomplete:",
			syncResponse.errors
				.map((entry) => `${entry.resource}: ${entry.message}`)
				.join("; "),
		);
	}

	let catalog = extractResourceCatalog(syncResponse);
	if (!catalog) {
		const resourcesResponse = await wsClient.resources();
		catalog = resourcesResponse;
		if (resourcesResponse.errors?.length) {
			console.warn(
				"resource discovery was incomplete:",
				resourcesResponse.errors
					.map((entry) => `${entry.service}: ${entry.message}`)
					.join("; "),
			);
		}
	}

	return {
		flowGraph: extractFlowEntityCollections(syncResponse),
		serviceResources: flattenServiceResources(catalog),
		resourceAttributeMetadata: extractResourceAttributeMetadata(
			catalog,
			syncResponse,
		),
		serviceNamesById: serviceNamesById(catalog),
		formatters: extractFlatResourceRows(
			syncResponse,
			EVY_CORE_RESOURCE_REF.FORMATTERS,
			isDataEvyFormatter,
		),
	};
}
