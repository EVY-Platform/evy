import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	UI_ActionBranch,
} from "evy-types";
import {
	parseActionStringToInvocation,
	serializeInvocationToEditorString,
} from "evy-types/actionAst";
import { splitFunctionArguments } from "./functionArgs";
import { forEachRowInFlows, rowLocationLabel } from "./rowTraversal";
import { unwrapOptionalBraces } from "./unwrapBraces";

export const ACTION_FUNCTIONS = [
	"close",
	"create",
	"update",
	"navigate",
	"show",
	"highlight_required",
	"select",
	"select_photo",
	"expand_photo",
	"expand_text",
	"delete_photo",
] as const;
export type ActionFunction = (typeof ACTION_FUNCTIONS)[number];

export const FUNCTION_LABELS: Record<ActionFunction, string> = {
	close: "Close",
	create: "Create",
	update: "Update",
	navigate: "Navigate",
	show: "Show row",
	highlight_required: "Highlight required",
	select: "Select",
	select_photo: "Select photo",
	expand_photo: "Expand photo",
	expand_text: "Expand text",
	delete_photo: "Delete photo",
};

export const ROW_ID_ARG_FUNCTIONS = new Set<ActionFunction>([
	"show",
	"expand_text",
]);

export const ZERO_ARG_FUNCTIONS = new Set<ActionFunction>([
	"close",
	"select_photo",
	"expand_photo",
	"delete_photo",
]);

type ParsedBranch = {
	functionName: ActionFunction;
	args: string[];
};

function isActionFunction(name: string): name is ActionFunction {
	return ACTION_FUNCTIONS.includes(name as ActionFunction);
}

/**
 * The argument-slot editor works on a flat `fn(a,b)` rendering of a branch.
 * That text form is an editing convenience internal to the builder - it is
 * never persisted, and the API rejects it.
 */
export function branchToEditableString(branch: UI_ActionBranch): string {
	if (typeof branch === "string") {
		if (branch === "") return "";
		throw new Error(
			`Stored action branches must be structured invocations, got string: ${branch}`,
		);
	}
	return serializeInvocationToEditorString(branch);
}

/**
 * Turns the editor's text form into what gets persisted. Only the empty string
 * and structured invocations are storable, so an unconvertible branch is a bug
 * in the editor rather than something to persist and discover later.
 */
export function branchForStorage(branchString: string): UI_ActionBranch {
	const trimmed = branchString.trim();
	if (!trimmed) return "";
	const converted = parseActionStringToInvocation(trimmed);
	if (!converted.ok) {
		throw new Error(
			`Cannot store action branch "${branchString}": ${converted.reason}`,
		);
	}
	return converted.invocation;
}

/**
 * Parses a stored branch.
 *
 * Storage is structured; the editor works in text. Both forms are readable, so
 * this converts and hands off to `parseBranchText` rather than each caller
 * guessing which one it holds.
 */
export function parseBranch(branch: UI_ActionBranch): ParsedBranch | null {
	return parseBranchText(branchToEditableString(branch));
}

/** Parses the editor's text form, which is not storable until finalized. */
export function parseBranchText(branchText: string): ParsedBranch | null {
	const trimmed = branchText.trim();
	if (!trimmed) return null;

	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const inner = unwrapOptionalBraces(trimmed);

		const parenIndex = inner.indexOf("(");
		if (parenIndex !== -1 && inner.endsWith(")")) {
			const functionName = inner.slice(0, parenIndex).trim();
			const argsString = inner.slice(parenIndex + 1, -1).trim();
			const args = splitFunctionArguments(argsString);

			if (isActionFunction(functionName)) {
				return { functionName, args };
			}
		}
	}

	return null;
}

function trimTrailingEmptyArgs(args: string[]): string[] {
	let end = args.length;
	while (end > 0 && !args[end - 1]?.trim()) {
		end--;
	}
	return args.slice(0, end);
}

export function serializeBranch(
	functionName: ActionFunction | "",
	args: string[],
): string {
	if (!functionName) return "";

	const trimmedArgs = trimTrailingEmptyArgs(args);

	if (ZERO_ARG_FUNCTIONS.has(functionName)) {
		return `{${functionName}()}`;
	}

	if (ROW_ID_ARG_FUNCTIONS.has(functionName)) {
		const rowId = trimmedArgs[0]?.trim();
		return rowId ? `{${functionName}(${rowId})}` : "";
	}

	if (trimmedArgs.length === 0) return `{${functionName}()}`;
	return `{${functionName}(${trimmedArgs.join(",")})}`;
}

export function createUsesSubmitMarker(args: string[]): boolean {
	return args[2]?.trim() === "submit";
}

export function createHasInlineDataArg(args: string[]): boolean {
	const thirdArg = args[2]?.trim() ?? "";
	return Boolean(thirdArg) && thirdArg !== "submit";
}

export function updateUsesDraftMarker(args: string[]): boolean {
	return args[4]?.trim() === "draft";
}

export function applyCreateModeForDraftSignals(
	args: string[],
	offerSubmitWithFlow: boolean,
): string[] {
	if (createHasInlineDataArg(args)) {
		return args;
	}
	if (offerSubmitWithFlow) {
		if (createUsesSubmitMarker(args) && !args[3]?.trim()) {
			return args;
		}
		const newArgs = [...args];
		newArgs[2] = "submit";
		if (newArgs.length > 3) {
			newArgs[3] = "";
		}
		return newArgs;
	}
	if (createUsesSubmitMarker(args)) {
		const newArgs = [...args];
		newArgs[2] = "";
		if (newArgs.length > 3) {
			newArgs[3] = "";
		}
		return newArgs;
	}
	return args;
}

export function isValidCreateBranchForSave(
	args: string[],
	offerSubmitWithFlow: boolean,
): boolean {
	const serviceId = args[0]?.trim() ?? "";
	const resourceId = args[1]?.trim() ?? "";
	if (!serviceId || !resourceId) return false;
	if (createHasInlineDataArg(args)) return true;
	if (offerSubmitWithFlow && createUsesSubmitMarker(args)) return true;
	return false;
}

export function finalizeCreateBranchForSave(
	branchString: string,
	offerSubmitWithFlow: boolean,
): string | null {
	const parsed = parseBranchText(branchString);
	if (parsed?.functionName !== "create") {
		return branchString;
	}

	const serviceId = parsed.args[0]?.trim() ?? "";
	const resourceId = parsed.args[1]?.trim() ?? "";
	if (!serviceId || !resourceId) {
		return branchString;
	}

	const nextArgs = applyCreateModeForDraftSignals(
		parsed.args,
		offerSubmitWithFlow,
	);
	if (!isValidCreateBranchForSave(nextArgs, offerSubmitWithFlow)) {
		return null;
	}

	const nextBranch = serializeBranch("create", nextArgs);
	return nextBranch === branchString ? branchString : nextBranch;
}

export function formatBranchDisplay(
	branchString: string,
	flowsById?: Record<string, DATA_EVY_Flow>,
	pagesById?: Record<string, DATA_EVY_Page>,
	rowsById?: Record<string, DATA_EVY_Row>,
): string {
	const parsed = parseBranchText(branchString);
	if (!parsed) return "None";

	if (
		ROW_ID_ARG_FUNCTIONS.has(parsed.functionName) &&
		rowsById &&
		flowsById &&
		pagesById &&
		parsed.args[0]
	) {
		const rowId = parsed.args[0].trim();
		const label = formatShowRowLabel(rowId, flowsById, pagesById, rowsById);
		return `${parsed.functionName}(${label})`;
	}

	if (
		parsed.functionName === "navigate" &&
		flowsById &&
		pagesById &&
		parsed.args.length >= 2
	) {
		const [flowId, pageId] = parsed.args;
		const flow = flowsById[flowId ?? ""];
		const flowName = flow?.name ?? flowId;
		const page = pagesById[pageId ?? ""];
		const pageName = page?.name ?? pageId;
		const queryDisplay = parsed.args[2] ? `, ${parsed.args[2]}` : "";
		return `${parsed.functionName}(${flowName}, ${pageName}${queryDisplay})`;
	}

	if (parsed.args.length === 0) return parsed.functionName;
	return `${parsed.functionName}(${parsed.args.join(", ")})`;
}

function formatShowRowLabel(
	rowId: string,
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
): string {
	const row = rowsById[rowId];
	if (!row) return rowId;

	const label = forEachRowInFlows(
		flowsById,
		pagesById,
		rowsById,
		(flow, page, _row, id) =>
			id === rowId ? rowLocationLabel(flow, page, row) : null,
	);
	return label ?? (row.name || rowId);
}
