import type { UI_Flow } from "../types/flow";
import type { Row } from "../types/row";
import { findFlowById } from "./flowHelpers";
import { getRowsRecursive } from "./rowTree";
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

function collectDestinations(row: Row, result: Set<string>): void {
	for (const subRow of getRowsRecursive(row)) {
		const destination = subRow.config.destination;
		if (destination) {
			const variableName = extractVariableFromDestination(destination);
			if (variableName) result.add(variableName);
		}
	}
}

export function extractDraftVariables(
	flows: UI_Flow[],
	activeFlowId: string | undefined,
): string[] {
	const flow = findFlowById(flows, activeFlowId);
	if (!flow) return [];

	const variables = new Set<string>();
	for (const page of flow.pages) {
		for (const row of page.rows) {
			collectDestinations(row, variables);
		}
		if (page.footer) {
			collectDestinations(page.footer, variables);
		}
	}
	return Array.from(variables).sort();
}

function entityRoot(variable: string): string {
	const dotIndex = variable.indexOf(".");
	return dotIndex === -1 ? variable : variable.slice(0, dotIndex);
}

/**
 * Extracts unique root entity names from draft variables.
 * For example, given `["item.title", "item.description"]` returns `["item"]`.
 */
export function extractDraftEntities(
	flows: UI_Flow[],
	activeFlowId: string | undefined,
): string[] {
	const variables = extractDraftVariables(flows, activeFlowId);
	const entities = new Set(variables.map(entityRoot));
	return Array.from(entities).sort();
}
