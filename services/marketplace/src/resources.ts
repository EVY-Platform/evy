import type { ResourcesResponse } from "evy-types";
import type { ResourceCatalogVisibility } from "evy-types/coreResources";
import { formatResourceRef } from "evy-types/resourceRef";
import { validateResourcesResponse } from "evy-types/validators";
import { attributesFromSchema } from "./attributes";
import { itemSchema, itemStatusSchema, lookupSchema } from "./validation";

const ITEM_ATTRIBUTES = attributesFromSchema(itemSchema);
const LOOKUP_ATTRIBUTES = attributesFromSchema(lookupSchema);
const ITEM_STATUS_ATTRIBUTES = attributesFromSchema(itemStatusSchema);

const MARKETPLACE_SERVICE_SLUG = "marketplace" as const;

const MARKETPLACE_RESOURCE_DEFINITIONS = [
	{
		name: "selling_reasons",
		attributes: LOOKUP_ATTRIBUTES,
		visibility: "public",
	},
	{
		name: "conditions",
		attributes: LOOKUP_ATTRIBUTES,
		visibility: "public",
	},
	{
		name: "durations",
		attributes: LOOKUP_ATTRIBUTES,
		visibility: "public",
	},
	{
		name: "areas",
		attributes: LOOKUP_ATTRIBUTES,
		visibility: "public",
	},
	{
		name: "items",
		attributes: ITEM_ATTRIBUTES,
		visibility: "public",
	},
	{
		name: "item_statuses",
		attributes: ITEM_STATUS_ATTRIBUTES,
		visibility: "internal",
	},
] as const satisfies ReadonlyArray<{
	name: string;
	attributes: readonly string[];
	visibility: ResourceCatalogVisibility;
}>;

export const MARKETPLACE_SERVICE_DESCRIPTOR = {
	id: MARKETPLACE_SERVICE_SLUG,
	name: MARKETPLACE_SERVICE_SLUG,
	resources: MARKETPLACE_RESOURCE_DEFINITIONS.map(
		({ name, attributes, visibility }) => ({
			id: formatResourceRef(MARKETPLACE_SERVICE_SLUG, name),
			name,
			attributes,
			visibility,
		}),
	),
} as const;

export const MARKETPLACE_SERVICE = MARKETPLACE_SERVICE_DESCRIPTOR.id;

export const MARKETPLACE_RESOURCE = {
	SELLING_REASONS: formatResourceRef(
		MARKETPLACE_SERVICE_SLUG,
		"selling_reasons",
	),
	CONDITIONS: formatResourceRef(MARKETPLACE_SERVICE_SLUG, "conditions"),
	DURATIONS: formatResourceRef(MARKETPLACE_SERVICE_SLUG, "durations"),
	AREAS: formatResourceRef(MARKETPLACE_SERVICE_SLUG, "areas"),
	ITEMS: formatResourceRef(MARKETPLACE_SERVICE_SLUG, "items"),
	ITEM_STATUSES: formatResourceRef(MARKETPLACE_SERVICE_SLUG, "item_statuses"),
} as const;

export const MARKETPLACE_RESOURCE_CATALOG_VISIBILITY: Readonly<
	Record<string, ResourceCatalogVisibility>
> = Object.fromEntries(
	MARKETPLACE_SERVICE_DESCRIPTOR.resources.map((resource) => [
		resource.id,
		resource.visibility,
	]),
);

export const MARKETPLACE_SEED_RESOURCES: ReadonlySet<string> = new Set(
	MARKETPLACE_SERVICE_DESCRIPTOR.resources.map((resource) => resource.id),
);

export function marketplaceResourceCatalogVisibility(
	resourceRef: string,
): ResourceCatalogVisibility | undefined {
	return MARKETPLACE_RESOURCE_CATALOG_VISIBILITY[resourceRef];
}

const MARKETPLACE_RESOURCES_RESPONSE = validateResourcesResponse({
	services: [MARKETPLACE_SERVICE_DESCRIPTOR],
});

export function getMarketplaceResourcesResponse(): ResourcesResponse {
	return MARKETPLACE_RESOURCES_RESPONSE;
}
