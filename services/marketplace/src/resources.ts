import type { ResourcesResponse } from "evy-types";
import { validateResourcesResponse } from "evy-types/validators";
import { attributesFromSchema } from "./attributes";
import { itemSchema, lookupSchema } from "./validation";

// Derived from the schemas this service validates against, so the attributes
// it advertises to the builder are exactly the ones it accepts.
const ITEM_ATTRIBUTES = attributesFromSchema(itemSchema);
const LOOKUP_ATTRIBUTES = attributesFromSchema(lookupSchema);

export const MARKETPLACE_SERVICE_DESCRIPTOR = {
	id: "66b092ae-7cd8-4d67-95b7-30b03568fd90",
	name: "marketplace",
	resources: [
		{
			id: "e9ec5573-bd2f-4ad1-b24f-44a1bf8314e8",
			name: "selling_reasons",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f",
			name: "conditions",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "e82e1baa-6d33-4649-b495-4e10a4d1d8bf",
			name: "durations",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "2532b561-3b14-458b-9039-307e99c4a4ba",
			name: "areas",
			attributes: LOOKUP_ATTRIBUTES,
		},
		{
			id: "dc28ed59-298e-493c-8ff3-3e60f2ebccbd",
			name: "items",
			attributes: ITEM_ATTRIBUTES,
		},
	],
} as const;

export const MARKETPLACE_SERVICE = MARKETPLACE_SERVICE_DESCRIPTOR.id;

function marketplaceResourceId(name: string): string {
	const resource = MARKETPLACE_SERVICE_DESCRIPTOR.resources.find(
		(entry) => entry.name === name,
	);
	if (!resource) {
		throw new Error(`Unknown marketplace resource: ${name}`);
	}
	return resource.id;
}

export const MARKETPLACE_RESOURCE = {
	SELLING_REASONS: marketplaceResourceId("selling_reasons"),
	CONDITIONS: marketplaceResourceId("conditions"),
	DURATIONS: marketplaceResourceId("durations"),
	AREAS: marketplaceResourceId("areas"),
	ITEMS: marketplaceResourceId("items"),
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
