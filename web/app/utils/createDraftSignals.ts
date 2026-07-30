import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import {
	branchToEditableString,
	finalizeCreateBranchForSave,
	parseBranchText,
	updateUsesDraftMarker,
} from "./actionBranch";
import { allRowActions, normalizeStoredRowActions } from "./rowActions";
import { forEachRowInFlow } from "./rowTraversal";
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

type DraftSignals = {
	draftVariables: string[];
	draftUpdateTargets: Set<string>;
	/** Dotted resource ref the active flow declares it submits, if any. */
	declaredSubmits: string | null;
};

export function collectDraftSignals(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	activeFlowId: string | undefined,
): DraftSignals {
	const flow = activeFlowId ? flowsById[activeFlowId] : undefined;
	if (!flow) {
		return {
			draftVariables: [],
			draftUpdateTargets: new Set(),
			declaredSubmits: null,
		};
	}

	const declaredSubmits = flow.submits?.resource ?? null;

	const variables = new Set<string>();
	const draftUpdateTargets = new Set<string>();

	forEachRowInFlow(flow, pagesById, rowsById, (_id, row) => {
		const destination = row.data.destination;
		if (typeof destination === "string" && destination) {
			const variable = extractVariableFromDestination(destination);
			if (variable) variables.add(variable);
		}

		const actions = normalizeStoredRowActions(row.data.actions);
		for (const action of allRowActions(actions)) {
			for (const branch of [action.true, action.false]) {
				const trimmed = branchToEditableString(branch).trim();
				if (!trimmed) continue;
				const parsed = parseBranchText(trimmed);
				if (parsed?.functionName !== "update") continue;
				const resourceRef = parsed.args[0]?.trim();
				if (!resourceRef) continue;
				if (!updateUsesDraftMarker(parsed.args)) continue;
				draftUpdateTargets.add(resourceRef);
			}
		}
	});

	return {
		draftVariables: Array.from(variables).sort(),
		draftUpdateTargets,
		declaredSubmits,
	};
}

export function shouldOfferCreateSubmitWithFlow(
	resourceRef: string,
	declaredSubmits: string | null = null,
): boolean {
	if (!resourceRef || declaredSubmits === null) return false;
	return declaredSubmits === resourceRef;
}

export function finalizeBranchForSave(
	branchString: string,
	declaredSubmits: string | null = null,
): string | null {
	const trimmed = branchString.trim();
	if (!trimmed) return branchString;

	const parsed = parseBranchText(trimmed);
	if (parsed?.functionName !== "create") {
		return branchString;
	}

	const resourceRef = parsed.args[0]?.trim() ?? "";
	const offerSubmit = shouldOfferCreateSubmitWithFlow(
		resourceRef,
		declaredSubmits,
	);

	return finalizeCreateBranchForSave(trimmed, offerSubmit);
}
