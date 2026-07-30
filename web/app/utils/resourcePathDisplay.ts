import { splitRefFromPath } from "evy-types/resourceRef";
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
	const split = splitRefFromPath(variablePath);
	if (split) {
		const resourceName = resourceNamesByRef.get(split.ref);
		if (resourceName) {
			return split.rest ? `${resourceName}.${split.rest}` : resourceName;
		}
	}

	return variablePath;
}
