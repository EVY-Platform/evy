/**
 * Service and resource choices offered by the builder.
 *
 * Shared by the action editor, which picks a service and a resource as two
 * separate arguments, and the flow-submits selector, which must pick both at
 * once because a half-chosen target is not a valid declaration.
 */

import type { PopoverOption } from "../components/PopoverSelect";
import type { ServiceResource } from "../types/resources";
import { displayLabel } from "./labelFormatting";

export function toServiceOptions(
	serviceNamesById: Map<string, string>,
): PopoverOption[] {
	return [...serviceNamesById.entries()]
		.map(([id, name]) => ({
			value: id,
			label: displayLabel(name),
		}))
		.toSorted((a, b) => a.label.localeCompare(b.label));
}

export function toResourceOptions(
	serviceResources: ServiceResource[],
	serviceId: string,
): PopoverOption[] {
	return serviceResources
		.filter((resource) => resource.serviceId === serviceId)
		.map((resource) => ({
			value: resource.id,
			label: displayLabel(resource.name),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

/** Separator is not a uuid character, so it cannot occur inside either id. */
const TARGET_SEPARATOR = "/";

export function submitTargetValue(target: {
	service: string;
	resource: string;
}): string {
	return `${target.service}${TARGET_SEPARATOR}${target.resource}`;
}

export function parseSubmitTargetValue(
	value: string,
): { service: string; resource: string } | undefined {
	const [service, resource] = value.split(TARGET_SEPARATOR);
	if (!service || !resource) return undefined;
	return { service, resource };
}

/**
 * Every complete `{service, resource}` pair, plus "None".
 *
 * Offered as whole targets rather than two dependent dropdowns: the schema
 * requires a non-empty resource, so a service chosen on its own is not a state
 * the flow can be saved in.
 */
export function submitTargetOptions(
	serviceResources: ServiceResource[],
	serviceNamesById: Map<string, string>,
): PopoverOption[] {
	const targets = toServiceOptions(serviceNamesById).flatMap((service) =>
		toResourceOptions(serviceResources, service.value).map((resource) => ({
			value: submitTargetValue({
				service: service.value,
				resource: resource.value,
			}),
			label: `${service.label} / ${resource.label}`,
		})),
	);
	return [{ value: "", label: "None" }, ...targets];
}
