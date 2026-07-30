/**
 * Service and resource choices offered by the builder.
 *
 * Resource option values are full dotted refs (`marketplace.items`). The
 * flow-submits selector picks one ref because a half-chosen target is not a
 * valid declaration.
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
): PopoverOption[] {
	return serviceResources
		.map((resource) => ({
			value: resource.id,
			label: displayLabel(resource.name),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function submitTargetValue(target: { resource: string }): string {
	return target.resource;
}

export function parseSubmitTargetValue(
	value: string,
): { resource: string } | undefined {
	if (!value) return undefined;
	return { resource: value };
}

/**
 * Every declared resource ref, plus "None".
 */
export function submitTargetOptions(
	serviceResources: ServiceResource[],
): PopoverOption[] {
	const targets = toResourceOptions(serviceResources);
	return [{ value: "", label: "None" }, ...targets];
}
