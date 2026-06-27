import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";
import { unwrapOptionalBraces } from "./unwrapBraces";

export const ACTION_FUNCTIONS = [
	"close",
	"create",
	"navigate",
	"show",
	"highlight_required",
] as const;
export type ActionFunction = (typeof ACTION_FUNCTIONS)[number];

export const FUNCTION_LABELS: Record<ActionFunction, string> = {
	close: "Close",
	create: "Create",
	navigate: "Navigate",
	show: "Show child sheet",
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

function splitFunctionArguments(argsString: string): string[] {
	if (!argsString.trim()) return [];

	const args: string[] = [];
	let current = "";
	let parenDepth = 0;
	let bracketDepth = 0;
	let braceDepth = 0;
	let inString: '"' | "'" | null = null;
	let previousChar = "";

	for (const char of argsString) {
		if (inString) {
			current += char;
			if (char === inString && previousChar !== "\\") {
				inString = null;
			}
			previousChar = char;
			continue;
		}

		if (char === '"' || char === "'") {
			inString = char;
			current += char;
			previousChar = char;
			continue;
		}

		if (char === "(") parenDepth++;
		if (char === ")") parenDepth--;
		if (char === "[") bracketDepth++;
		if (char === "]") bracketDepth--;
		if (char === "{") braceDepth++;
		if (char === "}") braceDepth--;

		if (
			char === "," &&
			parenDepth === 0 &&
			bracketDepth === 0 &&
			braceDepth === 0
		) {
			const trimmed = current.trim();
			if (trimmed) args.push(trimmed);
			current = "";
			previousChar = char;
			continue;
		}

		current += char;
		previousChar = char;
	}

	const trimmed = current.trim();
	if (trimmed) args.push(trimmed);
	return args;
}

export function serializeBranch(
	functionName: ActionFunction | "",
	args: string[],
): string {
	if (!functionName) return "";

	const filteredArgs = args.filter(Boolean);

	if (functionName === "close") return "{close()}";

	if (filteredArgs.length === 0) return `{${functionName}()}`;
	return `{${functionName}(${filteredArgs.join(",")})}`;
}

export function formatBranchDisplay(
	branchString: string,
	flowsById?: Record<string, DATA_EVY_Flow>,
	pagesById?: Record<string, DATA_EVY_Page>,
): string {
	const parsed = parseBranch(branchString);
	if (!parsed) return "None";

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
		const pageName = page?.title || page?.id || pageId;
		const queryDisplay = parsed.args[2] ? `, ${parsed.args[2]}` : "";
		return `${parsed.functionName}(${flowName}, ${pageName}${queryDisplay})`;
	}

	if (parsed.args.length === 0) return parsed.functionName;
	return `${parsed.functionName}(${parsed.args.join(", ")})`;
}
