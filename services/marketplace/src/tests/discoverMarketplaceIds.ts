import { validateResourcesResponse } from "evy-types/validators";

export function discoverMarketplaceIds(
	response: unknown,
	resourceNames: readonly string[],
): { serviceId: string; resourceIds: Record<string, string> } {
	const validated = validateResourcesResponse(response);
	const marketplaceService = validated.services.find(
		(service) => service.name === "marketplace",
	);
	if (!marketplaceService) {
		throw new Error("Expected marketplace service in resources response");
	}

	const resourceIds: Record<string, string> = {};
	for (const resourceName of resourceNames) {
		const resource = marketplaceService.resources.find(
			(entry) => entry.name === resourceName,
		);
		if (!resource) {
			throw new Error(
				`Expected ${resourceName} resource in marketplace manifest`,
			);
		}
		resourceIds[resourceName] = resource.id;
	}

	return {
		serviceId: marketplaceService.id,
		resourceIds,
	};
}
