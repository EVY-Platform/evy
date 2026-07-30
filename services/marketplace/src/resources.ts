import type { ResourcesResponse } from "evy-types";
import { formatResourceRef } from "evy-types/resourceRef";
import { validateResourcesResponse } from "evy-types/validators";
import { attributesFromSchema } from "./attributes";
import { itemSchema, lookupSchema } from "./validation";

// Derived from the schemas this service validates against, so the attributes
// it advertises to the builder are exactly the ones it accepts.
const ITEM_ATTRIBUTES = attributesFromSchema(itemSchema);
const LOOKUP_ATTRIBUTES = attributesFromSchema(lookupSchema);

const MARKETPLACE_SERVICE_SLUG = "marketplace" as const;

const MARKETPLACE_RESOURCE_DEFINITIONS = [
	{ name: "selling_reasons", attributes: LOOKUP_ATTRIBUTES },
	{ name: "conditions", attributes: LOOKUP_ATTRIBUTES },
	{ name: "durations", attributes: LOOKUP_ATTRIBUTES },
	{ name: "areas", attributes: LOOKUP_ATTRIBUTES },
	{ name: "items", attributes: ITEM_ATTRIBUTES },
] as const;

export const MARKETPLACE_SERVICE_DESCRIPTOR = {
	id: MARKETPLACE_SERVICE_SLUG,
	name: MARKETPLACE_SERVICE_SLUG,
	resources: MARKETPLACE_RESOURCE_DEFINITIONS.map(({ name, attributes }) => ({
		id: formatResourceRef(MARKETPLACE_SERVICE_SLUG, name),
		name,
		attributes,
	})),
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
