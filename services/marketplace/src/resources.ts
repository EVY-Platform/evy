import type { ResourcesResponse } from "evy-types";
import {
	MARKETPLACE_RESOURCE_MANIFEST,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";

export {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_RESOURCE_MANIFEST,
	MARKETPLACE_SEED_RESOURCES,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";

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
