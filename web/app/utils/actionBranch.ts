import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { splitFunctionArguments } from "./functionArgs";
import { unwrapOptionalBraces } from "./unwrapBraces";

export const ACTION_FUNCTIONS = [
	"close",
	"create",
	"update",
	"navigate",
	"show",
	"highlight_required",
] as const;
export type ActionFunction = (typeof ACTION_FUNCTIONS)[number];

export const FUNCTION_LABELS: Record<ActionFunction, string> = {
	close: "Close",
	create: "Create",
	update: "Update",
	navigate: "Navigate",
	show: "Show row",
	highlight_required: "Highlight required",
};

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

	const filteredArgs = args.filter(Boolean);

	if (functionName === "close") return "{close()}";

	if (functionName === "show") {
		const rowId = filteredArgs[0]?.trim();
		return rowId ? `{show(${rowId})}` : "";
	}

	if (filteredArgs.length === 0) return `{${functionName}()}`;
	return `{${functionName}(${filteredArgs.join(",")})}`;
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
		parsed.functionName === "show" &&
		rowsById &&
		flowsById &&
		pagesById &&
		parsed.args[0]
	) {
		const rowId = parsed.args[0].trim();
		const label = formatShowRowLabel(rowId, flowsById, pagesById, rowsById);
		return `show(${label})`;
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

	for (const flow of Object.values(flowsById)) {
		for (const pageId of flow.pageIds) {
			const page = pagesById[pageId];
			if (!page) continue;
			const roots = page.footerRowId
				? [...page.rowIds, page.footerRowId]
				: [...page.rowIds];
			if (findRowOnPage(roots, rowId, rowsById)) {
				return `${flow.name} / ${page.name} / ${row.name}`;
			}
		}
	}
	return row.name || rowId;
}

function findRowOnPage(
	rootIds: string[],
	targetRowId: string,
	rowsById: Record<string, DATA_EVY_Row>,
): boolean {
	const stack = [...rootIds];
	const visited = new Set<string>();
	while (stack.length > 0) {
		const id = stack.pop();
		if (!id || visited.has(id)) continue;
		visited.add(id);
		if (id === targetRowId) return true;
		const row = rowsById[id];
		if (!row) continue;
		const childId = row.data.child_row_id;
		if (typeof childId === "string") stack.push(childId);
		const sheetId = row.data.sheet_row_id;
		if (typeof sheetId === "string") stack.push(sheetId);
		const childrenIds = row.data.children_row_ids;
		if (Array.isArray(childrenIds)) {
			for (const child of childrenIds) {
				if (typeof child === "string") stack.push(child);
			}
		}
	}
	return false;
}
