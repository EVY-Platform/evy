import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { collectDraftSignals } from "./createDraftSignals";

export function extractDraftVariables(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	activeFlowId: string | undefined,
): string[] {
	return collectDraftSignals(flowsById, pagesById, rowsById, activeFlowId)
		.draftVariables;
}
