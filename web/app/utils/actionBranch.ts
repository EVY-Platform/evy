import type { SDUI_Flow } from "../types/flow";
import { findFlowById } from "./flowHelpers";
import { unwrapOptionalBraces } from "./unwrapBraces";

export const ACTION_FUNCTIONS = [
	"close",
	"create",
	"navigate",
	"highlight_required",
] as const;
export type ActionFunction = (typeof ACTION_FUNCTIONS)[number];

export const FUNCTION_LABELS: Record<ActionFunction, string> = {
	close: "Close",
	create: "Create",
	navigate: "Navigate",
	highlight_required: "Highlight required",
};

export type ParsedBranch = {
	functionName: ActionFunction;
	args: string[];
};

function isActionFunction(name: string): name is ActionFunction {
	return ACTION_FUNCTIONS.includes(name as ActionFunction);
}

export function parseBranch(branchString: string): ParsedBranch | null {
	const trimmed = branchString.trim();
	if (!trimmed) return null;

	if (trimmed === "close") {
		return { functionName: "close", args: [] };
	}

	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const inner = unwrapOptionalBraces(trimmed);

		if (inner === "close") {
			return { functionName: "close", args: [] };
		}

		const parenIndex = inner.indexOf("(");
		if (parenIndex !== -1 && inner.endsWith(")")) {
			const functionName = inner.slice(0, parenIndex).trim();
			const argsString = inner.slice(parenIndex + 1, -1).trim();
			const args = argsString ? argsString.split(",").map((a) => a.trim()) : [];

			if (isActionFunction(functionName)) {
				return { functionName, args };
			}
		}
	}

	const colonParts = trimmed.split(":");
	const functionName = colonParts[0];
	if (isActionFunction(functionName)) {
		return { functionName, args: colonParts.slice(1) };
	}

	return null;
}

export function serializeBranch(
	functionName: ActionFunction | "",
	args: string[],
): string {
	if (!functionName) return "";

	const filteredArgs = args.filter(Boolean);

	if (functionName === "close") return "close";

	if (filteredArgs.length === 0) return `{${functionName}()}`;
	return `{${functionName}(${filteredArgs.join(",")})}`;
}

export function formatBranchDisplay(
	branchString: string,
	flows?: SDUI_Flow[],
): string {
	const parsed = parseBranch(branchString);
	if (!parsed) return "None";

	if (parsed.functionName === "navigate" && flows && parsed.args.length >= 2) {
		const [flowId, pageId] = parsed.args;
		const flow = findFlowById(flows, flowId);
		const flowName = flow?.name ?? flowId;
		const page = flow?.pages.find((p) => p.id === pageId);
		const pageName = page?.title || page?.id || pageId;
		return `${parsed.functionName}(${flowName}, ${pageName})`;
	}

	if (parsed.args.length === 0) return parsed.functionName;
	return `${parsed.functionName}(${parsed.args.join(", ")})`;
}
