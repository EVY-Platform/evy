import { coreResourceCatalogVisibility } from "evy-types/coreResources";
import { assertResourceMutable } from "evy-types/resourceMutable";

export function assertCoreResourceMutable(resource: string): void {
	assertResourceMutable(resource, coreResourceCatalogVisibility(resource));
}
