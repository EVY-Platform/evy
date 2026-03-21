import type { SDUI_Flow } from "../types/flow";
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
	flows: SDUI_Flow[],
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
