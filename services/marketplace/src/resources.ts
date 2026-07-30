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
	{
		key: "SELLING_REASONS",
		name: "selling_reasons",
		attributes: LOOKUP_ATTRIBUTES,
	},
	{ key: "CONDITIONS", name: "conditions", attributes: LOOKUP_ATTRIBUTES },
	{ key: "DURATIONS", name: "durations", attributes: LOOKUP_ATTRIBUTES },
	{ key: "AREAS", name: "areas", attributes: LOOKUP_ATTRIBUTES },
	{ key: "ITEMS", name: "items", attributes: ITEM_ATTRIBUTES },
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

export const MARKETPLACE_RESOURCE = Object.fromEntries(
	MARKETPLACE_RESOURCE_DEFINITIONS.map(({ key, name }) => [
		key,
		formatResourceRef(MARKETPLACE_SERVICE_SLUG, name),
	]),
) as {
	readonly SELLING_REASONS: string;
	readonly CONDITIONS: string;
	readonly DURATIONS: string;
	readonly AREAS: string;
	readonly ITEMS: string;
};

export const MARKETPLACE_SEED_RESOURCES: ReadonlySet<string> = new Set(
	MARKETPLACE_SERVICE_DESCRIPTOR.resources.map((resource) => resource.id),
);

const MARKETPLACE_RESOURCES_RESPONSE = validateResourcesResponse({
	services: [MARKETPLACE_SERVICE_DESCRIPTOR],
});

export function getMarketplaceResourcesResponse(): ResourcesResponse {
	return MARKETPLACE_RESOURCES_RESPONSE;
}
