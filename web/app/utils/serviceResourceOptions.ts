import type { PopoverOption } from "../components/PopoverSelect";
import type { ServiceResource } from "../types/resources";
import { displayLabel } from "./labelFormatting";

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
