import type { ResourcesResponse } from "evy-types";
import { validateResourcesResponse } from "evy-types/validators";
import { attributesFromSchema } from "./attributes";
import { itemSchema, lookupSchema } from "./validation";

// Derived from the schemas this service validates against, so the attributes
// it advertises to the builder are exactly the ones it accepts.
const ITEM_ATTRIBUTES = attributesFromSchema(itemSchema);
const LOOKUP_ATTRIBUTES = attributesFromSchema(lookupSchema);

export const MARKETPLACE_SERVICE_DESCRIPTOR = {
	id: "marketplace",
	name: "marketplace",
	resources: [
		{
			id: "marketplace.selling_reasons",
			name: "selling_reasons",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "marketplace.conditions",
			name: "conditions",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "marketplace.durations",
			name: "durations",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "marketplace.areas",
			name: "areas",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "marketplace.items",
			name: "items",
			attributes: ITEM_ATTRIBUTES,
		},
	],
} as const;

export const MARKETPLACE_SERVICE = MARKETPLACE_SERVICE_DESCRIPTOR.id;

export const MARKETPLACE_RESOURCE = {
	SELLING_REASONS: "marketplace.selling_reasons",
	CONDITIONS: "marketplace.conditions",
	DURATIONS: "marketplace.durations",
	AREAS: "marketplace.areas",
	ITEMS: "marketplace.items",
} as const;

export const MARKETPLACE_SEED_RESOURCES: ReadonlySet<string> = new Set(
	MARKETPLACE_SERVICE_DESCRIPTOR.resources.map((resource) => resource.id),
);

const MARKETPLACE_RESOURCES_RESPONSE = validateResourcesResponse({
	services: [MARKETPLACE_SERVICE_DESCRIPTOR],
});

export function getMarketplaceResourcesResponse(): ResourcesResponse {
	return MARKETPLACE_RESOURCES_RESPONSE;
}
