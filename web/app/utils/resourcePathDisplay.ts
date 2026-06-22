import type { ServiceResource } from "../api/sync";

export function resourceNameById(
	serviceResources: ServiceResource[],
): Map<string, string> {
	return new Map(
		serviceResources.map((resource) => [resource.id, resource.name]),
	);
}

export function formatResourcePathForDisplay(
	variablePath: string,
	resourceNamesById: Map<string, string>,
): string {
	const dotIndex = variablePath.indexOf(".");
	const resourceId =
		dotIndex === -1 ? variablePath : variablePath.slice(0, dotIndex);
	const pathSuffix = dotIndex === -1 ? "" : variablePath.slice(dotIndex);
	const resourceName = resourceNamesById.get(resourceId);
	return resourceName ? `${resourceName}${pathSuffix}` : variablePath;
}
