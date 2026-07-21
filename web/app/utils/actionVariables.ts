import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { pageRootIds, walkRows } from "./rowTraversal";
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

		walkRows(rowsById, pageRootIds(page), (_id, row) => {
			const destination = row.data.destination;
			if (typeof destination === "string" && destination) {
				const variable = extractVariableFromDestination(destination);
				if (variable) variables.add(variable);
			}
		});
	}

	return Array.from(variables).sort();
}
