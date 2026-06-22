import type { ServiceResource } from "../api/sync";
import type { UI_Flow } from "../types/flow";
import { displayLabel } from "./labelFormatting";
import { findFlowById } from "./flowHelpers";
import {
	formatResourcePathForDisplay,
	resourceNameById,
} from "./resourcePathDisplay";

export function toVariableOptions(
	variables: string[],
	serviceResources: ServiceResource[] = [],
): { value: string; label: string }[] {
	const resourceNamesById = resourceNameById(serviceResources);
	return variables.map((variable) => ({
		value: variable,
		label: displayLabel(
			formatResourcePathForDisplay(variable, resourceNamesById),
		),
	}));
}

export function getFlowOptions(
	flows: UI_Flow[],
): { value: string; label: string }[] {
	return flows.map((f) => ({ value: f.id, label: f.name }));
}

export function getPageOptions(
	flows: UI_Flow[],
	flowId: string,
): { value: string; label: string }[] {
	const flow = findFlowById(flows, flowId);
	if (!flow) return [];
	return flow.pages.map((p) => ({
		value: p.id,
		label: p.title || p.id,
	}));
}
