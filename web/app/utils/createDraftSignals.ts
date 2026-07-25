import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import {
	finalizeCreateBranchForSave,
	parseBranch,
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

function destinationDraftsTargetResource(
	draftVariables: string[],
	resourceId: string,
): boolean {
	return draftVariables.some(
		(name) => name === resourceId || name.startsWith(`${resourceId}.`),
	);
}

export type DraftSignals = {
	draftVariables: string[];
	draftUpdateTargets: Set<string>;
	/** `service/resource` the active flow declares it submits, if any. */
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

	const declaredSubmits = flow.submits
		? `${flow.submits.service}/${flow.submits.resource}`
		: null;

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
			for (const branchString of [action.true, action.false]) {
				const trimmed = branchString.trim();
				if (!trimmed) continue;
				const parsed = parseBranch(trimmed);
				if (parsed?.functionName !== "update") continue;
				const serviceId = parsed.args[0]?.trim();
				const resourceId = parsed.args[1]?.trim();
				if (!serviceId || !resourceId) continue;
				if (!updateUsesDraftMarker(parsed.args)) continue;
				draftUpdateTargets.add(`${serviceId}/${resourceId}`);
			}
		}
	});

	return {
		draftVariables: Array.from(variables).sort(),
		draftUpdateTargets,
		declaredSubmits,
	};
}

/**
 * A flow that declares what it submits decides this outright. Only undeclared
 * flows fall back to inferring it from destinations and draft-mode updates
 * elsewhere in the flow.
 */
export function shouldOfferCreateSubmitWithFlow(
	serviceId: string,
	resourceId: string,
	draftVariables: string[],
	draftUpdateTargets: Set<string>,
	declaredSubmits: string | null = null,
): boolean {
	if (!serviceId || !resourceId) return false;
	if (declaredSubmits !== null) {
		return declaredSubmits === `${serviceId}/${resourceId}`;
	}
	if (destinationDraftsTargetResource(draftVariables, resourceId)) {
		return true;
	}
	return draftUpdateTargets.has(`${serviceId}/${resourceId}`);
}

export function finalizeBranchForSave(
	branchString: string,
	draftVariables: string[],
	draftUpdateTargets: Set<string>,
	declaredSubmits: string | null = null,
): string | null {
	const trimmed = branchString.trim();
	if (!trimmed) return branchString;

	const parsed = parseBranch(trimmed);
	if (parsed?.functionName !== "create") {
		return branchString;
	}

	const serviceId = parsed.args[0]?.trim() ?? "";
	const resourceId = parsed.args[1]?.trim() ?? "";
	const offerSubmit = shouldOfferCreateSubmitWithFlow(
		serviceId,
		resourceId,
		draftVariables,
		draftUpdateTargets,
		declaredSubmits,
	);

	return finalizeCreateBranchForSave(trimmed, offerSubmit);
}
