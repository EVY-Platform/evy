import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
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

export function parseBranch(branchString: string): ParsedBranch | null {
	const trimmed = branchString.trim();
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

export function serializeBranch(
	functionName: ActionFunction | "",
	args: string[],
): string {
	if (!functionName) return "";

	// Draft-mode update uses an empty filter (`{}`); do not filter(Boolean) args or positions collapse.
	const filteredArgs = args.filter(Boolean);

	if (ZERO_ARG_FUNCTIONS.has(functionName)) {
		return `{${functionName}()}`;
	}

	if (ROW_ID_ARG_FUNCTIONS.has(functionName)) {
		const rowId = filteredArgs[0]?.trim();
		return rowId ? `{${functionName}(${rowId})}` : "";
	}

	if (filteredArgs.length === 0) return `{${functionName}()}`;
	return `{${functionName}(${filteredArgs.join(",")})}`;
}

export function createUsesSubmitMarker(args: string[]): boolean {
	return args[2]?.trim() === "submit";
}

export function createHasInlineDataArg(args: string[]): boolean {
	const thirdArg = args[2]?.trim() ?? "";
	return Boolean(thirdArg) && thirdArg !== "submit";
}

export function applyCreateModeForDraftSignals(
	args: string[],
	offerSubmitWithFlow: boolean,
): string[] {
	const newArgs = [...args];
	while (newArgs.length < 4) {
		newArgs.push("");
	}
	if (createHasInlineDataArg(newArgs)) {
		return newArgs;
	}
	if (offerSubmitWithFlow) {
		newArgs[2] = "submit";
		newArgs[3] = "";
	} else if (createUsesSubmitMarker(newArgs)) {
		newArgs[2] = "";
		newArgs[3] = "";
	}
	return newArgs;
}

export function formatBranchDisplay(
	branchString: string,
	flowsById?: Record<string, DATA_EVY_Flow>,
	pagesById?: Record<string, DATA_EVY_Page>,
	rowsById?: Record<string, DATA_EVY_Row>,
): string {
	const parsed = parseBranch(branchString);
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
