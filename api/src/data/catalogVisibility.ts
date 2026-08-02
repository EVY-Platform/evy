import { coreResourceCatalogVisibility } from "evy-types/coreResources";

export function assertCoreResourceMutable(resource: string): void {
	const visibility = coreResourceCatalogVisibility(resource);
	if (visibility === "internal") {
		throw new Error(
			`Resource "${resource}" is internal and cannot be created, updated, or deleted via the data API`,
		);
	}
}
