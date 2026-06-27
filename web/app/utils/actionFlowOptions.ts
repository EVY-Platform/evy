import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";
import type { ServiceResource } from "../api/sync";
import { displayLabel } from "./labelFormatting";
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
	flowsById: Record<string, DATA_EVY_Flow>,
): { value: string; label: string }[] {
	return Object.values(flowsById).map((f) => ({
		value: f.id,
		label: f.name,
	}));
}

export function getPageOptions(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	flowId: string,
): { value: string; label: string }[] {
	const flow = flowsById[flowId];
	if (!flow) return [];
	return flow.pageIds
		.map((id) => pagesById[id])
		.filter((p): p is DATA_EVY_Page => !!p)
		.map((p) => ({ value: p.id, label: p.title || p.id }));
}
