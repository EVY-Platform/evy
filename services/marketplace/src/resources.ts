import type { ResourcesResponse } from "evy-types";

export const MARKETPLACE_SERVICE =
	"66b092ae-7cd8-4d67-95b7-30b03568fd90" as const;

export const MARKETPLACE_RESOURCE_MANIFEST = [
	{
		id: "e9ec5573-bd2f-4ad1-b24f-44a1bf8314e8",
		name: "selling_reasons",
	},
	{
		id: "cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f",
		name: "conditions",
	},
	{
		id: "e82e1baa-6d33-4649-b495-4e10a4d1d8bf",
		name: "durations",
	},
	{
		id: "2532b561-3b14-458b-9039-307e99c4a4ba",
		name: "areas",
	},
	{
		id: "dc28ed59-298e-493c-8ff3-3e60f2ebccbd",
		name: "items",
	},
] as const;

export const MARKETPLACE_RESOURCE = {
	SELLING_REASONS: MARKETPLACE_RESOURCE_MANIFEST[0].id,
	CONDITIONS: MARKETPLACE_RESOURCE_MANIFEST[1].id,
	DURATIONS: MARKETPLACE_RESOURCE_MANIFEST[2].id,
	AREAS: MARKETPLACE_RESOURCE_MANIFEST[3].id,
	ITEMS: MARKETPLACE_RESOURCE_MANIFEST[4].id,
} as const;

export const MARKETPLACE_SEED_RESOURCES: ReadonlySet<string> = new Set(
	MARKETPLACE_RESOURCE_MANIFEST.map((resource) => resource.id),
);

export function getMarketplaceResourcesResponse(): ResourcesResponse {
	return {
		services: [
			{
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				resources: [...MARKETPLACE_RESOURCE_MANIFEST],
			},
		],
	};
}
