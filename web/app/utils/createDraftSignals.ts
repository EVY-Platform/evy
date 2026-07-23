import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { parseBranch } from "./actionBranch";
import { allRowActions, normalizeStoredRowActions } from "./rowActions";
import { pageRootIds, walkRows } from "./rowTraversal";

export function destinationDraftsTargetResource(
	draftVariables: string[],
	resourceId: string,
): boolean {
	return draftVariables.some(
		(name) => name === resourceId || name.startsWith(`${resourceId}.`),
	);
}

export function flowHasDraftUpdateForResource(
	flowActionBranches: string[],
	serviceId: string,
	resourceId: string,
): boolean {
	for (const branchString of flowActionBranches) {
		const parsed = parseBranch(branchString);
		if (parsed?.functionName !== "update") continue;
		if (parsed.args[0]?.trim() !== serviceId) continue;
		if (parsed.args[1]?.trim() !== resourceId) continue;
		if (parsed.args[4]?.trim() !== "draft") continue;
		return true;
	}
	return false;
}

export function shouldOfferCreateSubmitWithFlow(
	serviceId: string,
	resourceId: string,
	draftVariables: string[],
	flowActionBranches: string[],
): boolean {
	if (!serviceId || !resourceId) return false;
	if (destinationDraftsTargetResource(draftVariables, resourceId)) {
		return true;
	}
	return flowHasDraftUpdateForResource(
		flowActionBranches,
		serviceId,
		resourceId,
	);
}

export function collectFlowActionBranches(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	activeFlowId: string | undefined,
): string[] {
	const flow = activeFlowId ? flowsById[activeFlowId] : undefined;
	if (!flow) return [];

	const branches: string[] = [];
	for (const pageId of flow.pageIds) {
		const page = pagesById[pageId];
		if (!page) continue;

		walkRows(rowsById, pageRootIds(page), (_id, row) => {
			const actions = normalizeStoredRowActions(row.data.actions);
			for (const action of allRowActions(actions)) {
				const trueBranch = action.true.trim();
				const falseBranch = action.false.trim();
				if (trueBranch) branches.push(trueBranch);
				if (falseBranch) branches.push(falseBranch);
			}
			return null;
		});
	}
	return branches;
}
