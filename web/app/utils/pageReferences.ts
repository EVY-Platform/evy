import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { branchToEditableString, parseBranch } from "./actionBranch";
import { breadcrumbLabelForPage } from "./navLabels";
import { allRowActions, normalizeStoredRowActions } from "./rowActions";

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
	if (parsed?.functionName !== "navigate") return false;
	if (parsed.args.length < 2) return false;
	const [navFlowId, navPageId] = parsed.args;
	return navFlowId === flowId && navPageId === targetPageId;
}

/** Finds rows whose actions navigate to `targetPageId` within the same flow. */
export function findPageReferences(
	flowId: string,
	targetPageId: string,
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
): PageReferenceEntry[] {
	const flow = flowsById[flowId];
	if (!flow) return [];

	const flowPages = flow.pageIds
		.map((id) => pagesById[id])
		.filter((p): p is DATA_EVY_Page => !!p);

	const results: PageReferenceEntry[] = [];

	for (const page of flowPages) {
		const pageLabel = breadcrumbLabelForPage(page);

		for (const row of Object.values(rowsById)) {
			const actions = allRowActions(
				normalizeStoredRowActions(row.data.actions),
			);
			const references = actions.some(
				(action) =>
					branchReferencesPage(
						branchToEditableString(action.true),
						flowId,
						targetPageId,
					) ||
					branchReferencesPage(
						branchToEditableString(action.false),
						flowId,
						targetPageId,
					),
			);
			if (!references) continue;

			const rowLabel = row.name;
			results.push({
				referenceKey: `${page.id}:${row.id}`,
				pageLabel,
				rowLabel,
			});
		}
	}

	// Deduplicate by referenceKey
	const seen = new Set<string>();
	return results.filter((r) => {
		if (seen.has(r.referenceKey)) return false;
		seen.add(r.referenceKey);
		return true;
	});
}
