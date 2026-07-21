import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import type { ServiceResource } from "../types/resources";
import { displayLabel } from "./labelFormatting";
import {
	formatResourcePathForDisplay,
	resourceNameById,
} from "./resourcePathDisplay";
import { forEachRowInFlows, rowLocationLabel } from "./rowTraversal";

export type RowOption = { value: string; label: string };

export function getAllRowOptions(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
): RowOption[] {
	const options: RowOption[] = [];
	forEachRowInFlows(
		flowsById,
		pagesById,
		rowsById,
		(flow, page, row, rowId) => {
			options.push({
				value: rowId,
				label: rowLocationLabel(flow, page, row),
			});
		},
	);
	return options.sort((a, b) => a.label.localeCompare(b.label));
}

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
		.map((p) => ({ value: p.id, label: p.name }));
}
