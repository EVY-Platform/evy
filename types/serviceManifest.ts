import type { ResourcesResponse } from "./generated/ts/rpc/resources.response";

export type { ResourcesResponse };

export type ServiceDescriptor = ResourcesResponse["services"][number];
export type ResourceDescriptor = ServiceDescriptor["resources"][number];
export type ResourcesError = NonNullable<ResourcesResponse["errors"]>[number];

export function flattenServiceResources(
	response: ResourcesResponse,
): Array<{ id: string; fkServiceId: string; name: string }> {
	return response.services.flatMap((service) =>
		service.resources.map((resource) => ({
			id: resource.id,
			fkServiceId: service.id,
			name: resource.name,
		})),
	);
}

export function externalResourceRefs(
	response: ResourcesResponse,
	coreServiceId: string,
): Array<{ service: string; resource: string }> {
	return response.services.flatMap((service) => {
		if (service.id === coreServiceId) return [];
		return service.resources.map((resource) => ({
			service: service.id,
			resource: resource.id,
		}));
	});
}

export function serviceOptions(
	response: ResourcesResponse,
): Array<{ value: string; label: string }> {
	return response.services.map((service) => ({
		value: service.id,
		label: service.name,
	}));
}

export function serviceNameById(
	response: ResourcesResponse,
): Map<string, string> {
	return new Map(
		response.services.map((service) => [service.id, service.name]),
	);
}
