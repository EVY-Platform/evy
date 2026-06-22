import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";

export { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE };

export const MARKETPLACE_SEED_RESOURCES: ReadonlySet<string> = new Set(
	Object.values(MARKETPLACE_RESOURCE),
);
