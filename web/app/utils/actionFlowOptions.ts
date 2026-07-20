import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import type { ServiceResource } from "../types/resources";
import { pageRootIds } from "./flatGraph";
import { displayLabel } from "./labelFormatting";
import {
	formatResourcePathForDisplay,
	resourceNameById,
} from "./resourcePathDisplay";

export type RowOption = { value: string; label: string };

export function getAllRowOptions(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
): RowOption[] {
	const options: RowOption[] = [];

	for (const flow of Object.values(flowsById)) {
		for (const pageId of flow.pageIds) {
			const page = pagesById[pageId];
			if (!page) continue;
			const roots = pageRootIds(page);
			const visited = new Set<string>();
			const stack = [...roots];
			while (stack.length > 0) {
				const rowId = stack.pop();
				if (!rowId || visited.has(rowId)) continue;
				visited.add(rowId);
				const row = rowsById[rowId];
				if (!row) continue;
				options.push({
					value: rowId,
					label: `${flow.name} / ${page.name} / ${row.name}`,
				});
				const childId = row.data.child_row_id;
				if (typeof childId === "string") stack.push(childId);
				const sheetId = row.data.sheet_row_id;
				if (typeof sheetId === "string") stack.push(sheetId);
				const childrenIds = row.data.children_row_ids;
				if (Array.isArray(childrenIds)) {
					for (const child of childrenIds) {
						if (typeof child === "string") stack.push(child);
					}
				}
			}
		}
	}

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
