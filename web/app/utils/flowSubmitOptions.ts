import { isValidResourceRef, serviceOfRef } from "evy-types/resourceRef";
import type { PopoverOption } from "../components/PopoverSelect";
import type { ServiceResource } from "../types/resources";
import { displayLabel } from "./labelFormatting";
import { toResourceOptions } from "./serviceResourceOptions";

export function serviceOptionsFor(
	serviceResources: ServiceResource[],
	serviceNamesById: Map<string, string>,
): PopoverOption[] {
	const serviceIds = new Set<string>();
	for (const resource of serviceResources) {
		if (isValidResourceRef(resource.id)) {
			serviceIds.add(serviceOfRef(resource.id));
		}
	}
	return [...serviceIds]
		.map((serviceId) => ({
			value: serviceId,
			label: serviceNamesById.get(serviceId) ?? displayLabel(serviceId),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function resourceOptionsForService(
	serviceResources: ServiceResource[],
	serviceId: string,
): PopoverOption[] {
	if (serviceId === "") return [];
	return toResourceOptions(
		serviceResources.filter(
			(resource) =>
				isValidResourceRef(resource.id) &&
				serviceOfRef(resource.id) === serviceId,
		),
	);
}

export function serviceOfSubmitsRef(ref: string): string {
	if (ref === "" || !isValidResourceRef(ref)) return "";
	return serviceOfRef(ref);
}
