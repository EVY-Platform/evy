import type { SDUI_Flow } from "../types/flow";
import { displayLabel } from "./labelFormatting";
import { findFlowById } from "./flowHelpers";

export function toVariableOptions(
	variables: string[],
): { value: string; label: string }[] {
	return variables.map((v) => ({ value: v, label: displayLabel(v) }));
}

export function getFlowOptions(
	flows: SDUI_Flow[],
): { value: string; label: string }[] {
	return flows.map((f) => ({ value: f.id, label: f.name }));
}

export function getPageOptions(
	flows: SDUI_Flow[],
	flowId: string,
): { value: string; label: string }[] {
	const flow = findFlowById(flows, flowId);
	if (!flow) return [];
	return flow.pages.map((p) => ({
		value: p.id,
		label: p.title || p.id,
	}));
}
