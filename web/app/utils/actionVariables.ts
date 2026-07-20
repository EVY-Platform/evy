import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { unwrapOptionalBraces } from "./unwrapBraces";

function extractVariableFromDestination(destination: string): string | null {
	const trimmed = destination.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
	const inner = unwrapOptionalBraces(trimmed);

	const parenIndex = inner.indexOf("(");
	if (parenIndex !== -1) {
		const closeIndex = inner.lastIndexOf(")");
		if (closeIndex > parenIndex) {
			return inner.slice(parenIndex + 1, closeIndex).trim();
		}
	}
	return inner;
}

export function extractDraftVariables(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	activeFlowId: string | undefined,
): string[] {
	const flow = activeFlowId ? flowsById[activeFlowId] : undefined;
	if (!flow) return [];

	const variables = new Set<string>();

	for (const pageId of flow.pageIds) {
		const page = pagesById[pageId];
		if (!page) continue;

		const rootIds = [...page.rowIds];
		if (page.footerRowId) rootIds.push(page.footerRowId);

		const visited = new Set<string>();
		const stack = [...rootIds];
		while (stack.length > 0) {
			const rowId = stack.pop();
			if (rowId === undefined || visited.has(rowId)) continue;
			visited.add(rowId);
			const row = rowsById[rowId];
			if (!row) continue;

			const destination = row.data.destination;
			if (typeof destination === "string" && destination) {
				const variable = extractVariableFromDestination(destination);
				if (variable) variables.add(variable);
			}

			const childId = row.data.child_row_id;
			if (typeof childId === "string") stack.push(childId);
			const sheetId = row.data.sheet_row_id;
			if (typeof sheetId === "string") stack.push(sheetId);
			const childrenIds = row.data.children_row_ids;
			if (Array.isArray(childrenIds)) {
				for (const id of childrenIds) {
					if (typeof id === "string") stack.push(id);
				}
			}
		}
	}

	return Array.from(variables).sort();
}
