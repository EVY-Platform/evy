import type { SDUI_Flow, SDUI_Page } from "../types/flow";
import type { Row } from "../types/row";
import { parseBranch } from "./actionBranch";
import { breadcrumbLabelForPage, breadcrumbLabelForRow } from "./navLabels";
import { getRowsRecursive } from "./rowTree";

export type PageReferenceEntry = {
	/** Stable key for list rendering (`${pageId}:${rowId}`). */
	referenceKey: string;
	pageLabel: string;
	rowLabel: string;
};

function branchReferencesPage(
	branchString: string,
	flowId: string,
	targetPageId: string,
): boolean {
	const parsed = parseBranch(branchString);
	if (!parsed || parsed.functionName !== "navigate") return false;
	if (parsed.args.length < 2) return false;
	const [navFlowId, navPageId] = parsed.args;
	return navFlowId === flowId && navPageId === targetPageId;
}

function rowReferencesTargetPage(
	row: Row,
	flowId: string,
	targetPageId: string,
): boolean {
	const actions = row.config.actions;
	if (!actions) return false;
	return actions.some(
		(action) =>
			branchReferencesPage(action.true, flowId, targetPageId) ||
			branchReferencesPage(action.false, flowId, targetPageId),
	);
}

function collectReferencesForPage(
	page: SDUI_Page,
	flow: SDUI_Flow,
	targetPageId: string,
	seenRowIds: Set<string>,
	results: PageReferenceEntry[],
): void {
	const pageLabel = breadcrumbLabelForPage(page, flow.pages);

	const visitRow = (row: Row) => {
		if (!rowReferencesTargetPage(row, flow.id, targetPageId)) return;
		if (seenRowIds.has(row.id)) return;
		seenRowIds.add(row.id);
		results.push({
			referenceKey: `${page.id}:${row.id}`,
			pageLabel,
			rowLabel: breadcrumbLabelForRow(row),
		});
	};

	for (const topRow of page.rows) {
		for (const row of getRowsRecursive(topRow)) {
			visitRow(row);
		}
	}
	if (page.footer) {
		for (const row of getRowsRecursive(page.footer)) {
			visitRow(row);
		}
	}
}

/** Finds rows in `flow` whose actions navigate to `targetPageId` within the same flow. */
export function findPageReferences(
	flow: SDUI_Flow,
	targetPageId: string,
): PageReferenceEntry[] {
	const results: PageReferenceEntry[] = [];
	const seenRowIds = new Set<string>();
	for (const page of flow.pages) {
		collectReferencesForPage(page, flow, targetPageId, seenRowIds, results);
	}
	return results;
}
