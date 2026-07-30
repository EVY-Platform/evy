import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	UI_ActionBranch,
} from "evy-types";
import { parseBranch } from "./actionBranch";
import { breadcrumbLabelForPage } from "./navLabels";
import { allRowActions, normalizeStoredRowActions } from "./rowActions";
import { pageRootIds, walkRows } from "./rowTraversal";

export type PageReferenceEntry = {
	/** Stable key for list rendering (`${pageId}:${rowId}`). */
	referenceKey: string;
	pageLabel: string;
	rowLabel: string;
};

function branchReferencesPage(
	branch: UI_ActionBranch,
	flowId: string,
	targetPageId: string,
): boolean {
	const parsed = parseBranch(branch);
	if (parsed?.functionName !== "navigate") return false;
	if (parsed.args.length < 2) return false;
	const [navFlowId, navPageId] = parsed.args;
	return navFlowId === flowId && navPageId === targetPageId;
}

function rowReferencesPage(
	row: DATA_EVY_Row,
	flowId: string,
	targetPageId: string,
): boolean {
	return allRowActions(normalizeStoredRowActions(row.data.actions)).some(
		(action) =>
			branchReferencesPage(action.true, flowId, targetPageId) ||
			branchReferencesPage(action.false, flowId, targetPageId),
	);
}

/**
 * Finds rows whose actions navigate to `targetPageId` within the same flow.
 *
 * Scoped to the rows each page actually contains. Scanning every row for every
 * page reported a matching row as belonging to pages that do not hold it, and
 * because the page id is part of the key, deduplication could not undo that.
 */
export function findPageReferences(
	flowId: string,
	targetPageId: string,
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
): PageReferenceEntry[] {
	const flow = flowsById[flowId];
	if (!flow) return [];

	const results: PageReferenceEntry[] = [];
	for (const pageId of flow.page_ids) {
		const page = pagesById[pageId];
		if (!page) continue;
		const pageLabel = breadcrumbLabelForPage(page);

		walkRows(rowsById, pageRootIds(page), (id, row) => {
			if (rowReferencesPage(row, flowId, targetPageId)) {
				results.push({
					referenceKey: `${page.id}:${id}`,
					pageLabel,
					rowLabel: row.name,
				});
			}
			// Never early-exit: every referencing row is wanted.
			return null;
		});
	}

	return results;
}
