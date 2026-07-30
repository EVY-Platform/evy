import type { ServiceResource } from "../types/resources";

export function resourceDisplayNames(
	serviceResources: ServiceResource[],
): Map<string, string> {
	return new Map(
		serviceResources.map((resource) => [resource.id, resource.name]),
	);
}

export function formatResourcePathForDisplay(
	variablePath: string,
	resourceNamesByRef: Map<string, string>,
): string {
	const segments = variablePath.split(".");
	if (segments.length >= 2) {
		const ref = `${segments[0]}.${segments[1]}`;
		const resourceName = resourceNamesByRef.get(ref);
		if (resourceName) {
			const rest = segments.slice(2).join(".");
			return rest ? `${resourceName}.${rest}` : resourceName;
		}
	}

	const dotIndex = variablePath.indexOf(".");
	const resourceId =
		dotIndex === -1 ? variablePath : variablePath.slice(0, dotIndex);
	const pathSuffix = dotIndex === -1 ? "" : variablePath.slice(dotIndex);
	const resourceName = resourceNamesByRef.get(resourceId);
	return resourceName ? `${resourceName}${pathSuffix}` : variablePath;
}
