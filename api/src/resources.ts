import pluralize from "pluralize";
import {
	getServiceNames,
	getServiceResources,
} from "evy-types/rpcRequestHelpers";

type ResourceEntry = {
	singular: string;
	plural: string;
};

export type ResourcesResponse = {
	resources: Record<string, ResourceEntry>;
	resourcesByService: Record<string, string[]>;
};

/**
 * JSON-RPC handler for "resources" method.
 * Returns the mapping of all resource names to their singular/plural forms,
 * plus a mapping of service names to their resource lists.
 * Computed on every call from the runtime registry (no stale cache).
 */
export async function resources(): Promise<ResourcesResponse> {
	const resourcesMap: Record<string, ResourceEntry> = {};
	const resourcesByService: Record<string, string[]> = {};

	for (const svc of getServiceNames()) {
		const svcResources = getServiceResources(svc) ?? [];
		resourcesByService[svc] = svcResources;
		for (const r of svcResources) {
			if (!resourcesMap[r]) {
				resourcesMap[r] = {
					singular: pluralize.singular(r),
					plural: pluralize.plural(r),
				};
			}
		}
	}

	return {
		resources: resourcesMap,
		resourcesByService,
	};
}
