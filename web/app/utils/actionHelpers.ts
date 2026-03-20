import type { SDUI_Flow } from "../types/flow";
import type { Row } from "../types/row";
import { displayLabel } from "./labelFormatting";
import { findFlowById } from "./flowHelpers";

export const COMPARISON_OPERATORS = ["==", "!=", ">", "<", ">=", "<="] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
	"==": "equals",
	"!=": "not equals",
	">": ">",
	"<": "<",
	">=": ">=",
	"<=": "<=",
};

export type ConditionPart = {
	left: string;
	operator: ComparisonOperator;
	right: string;
};

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

export function toVariableOptions(
	variables: string[],
): { value: string; label: string }[] {
	return variables.map((v) => ({ value: v, label: displayLabel(v) }));
}

function collectDestinations(row: Row, result: Set<string>): void {
	const destination = row.config.destination;
	if (destination) {
		const variableName = extractVariableFromDestination(destination);
		if (variableName) result.add(variableName);
	}
	const content = row.config.view.content;
	if (content.children) {
		for (const child of content.children) {
			collectDestinations(child, result);
		}
	}
	if (content.child) {
		collectDestinations(content.child, result);
	}
}

function extractVariableFromDestination(destination: string): string | null {
	const trimmed = destination.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
	const inner = trimmed.slice(1, -1).trim();

	const parenIndex = inner.indexOf("(");
	if (parenIndex !== -1) {
		const closeIndex = inner.lastIndexOf(")");
		if (closeIndex > parenIndex) {
			return inner.slice(parenIndex + 1, closeIndex).trim();
		}
	}
	return inner;
}

export function extractDraftVariables(
	flows: SDUI_Flow[],
	activeFlowId: string | undefined,
): string[] {
	const flow = findFlowById(flows, activeFlowId);
	if (!flow) return [];

	const variables = new Set<string>();
	for (const page of flow.pages) {
		for (const row of page.rows) {
			collectDestinations(row, variables);
		}
		if (page.footer) {
			collectDestinations(page.footer, variables);
		}
	}
	return Array.from(variables).sort();
}

export function parseCondition(conditionString: string): ConditionPart[] {
	const trimmed = conditionString.trim();
	if (!trimmed) return [];

	const inner =
		trimmed.startsWith("{") && trimmed.endsWith("}")
			? trimmed.slice(1, -1).trim()
			: trimmed;
	if (!inner) return [];

	const parts = inner.split("||").map((s) => s.trim());
	const result: ConditionPart[] = [];

	for (const part of parts) {
		const parsed = parseAtomicComparison(part);
		if (parsed) result.push(parsed);
	}
	return result;
}

function parseAtomicComparison(expression: string): ConditionPart | null {
	const trimmed = expression.trim();
	for (const op of [">=", "<=", "!=", "==", ">", "<"] as const) {
		const index = trimmed.indexOf(op);
		if (index !== -1) {
			const left = trimmed.slice(0, index).trim();
			const right = trimmed.slice(index + op.length).trim();
			if (left && right) {
				return { left, operator: op, right };
			}
		}
	}
	return null;
}

export function serializeCondition(conditions: ConditionPart[]): string {
	if (conditions.length === 0) return "";
	const parts = conditions.map((c) => `${c.left} ${c.operator} ${c.right}`);
	return `{${parts.join(" || ")}}`;
}

export function parseBranch(branchString: string): ParsedBranch | null {
	const trimmed = branchString.trim();
	if (!trimmed) return null;

	if (trimmed === "close") {
		return { functionName: "close", args: [] };
	}

	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const inner = trimmed.slice(1, -1).trim();

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

function isActionFunction(name: string): name is ActionFunction {
	return ACTION_FUNCTIONS.includes(name as ActionFunction);
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

export function getFlowOptions(
	flows: SDUI_Flow[],
): { value: string; label: string }[] {
	return flows.map((f) => ({ value: f.id, label: f.name }));
}

export function getPageOptions(
	flows: SDUI_Flow[],
	flowId: string,
): { value: string; label: string }[] {
	const flow = findFlowById(flows, flowId);
	if (!flow) return [];
	return flow.pages.map((p) => ({
		value: p.id,
		label: p.title || p.id,
	}));
}

export const CONDITION_FUNCTIONS = ["count", "length"] as const;
export type ConditionFunction = (typeof CONDITION_FUNCTIONS)[number];

export type ParsedOperand =
	| { type: "value"; value: string }
	| { type: "function"; name: ConditionFunction; arg: string };

export function parseOperand(operand: string): ParsedOperand {
	const match = operand.match(/^([a-zA-Z_]+)\(([^)]*)\)$/);
	if (match && isConditionFunction(match[1])) {
		return { type: "function", name: match[1], arg: match[2].trim() };
	}
	return { type: "value", value: operand };
}

export function serializeOperand(parsed: ParsedOperand): string {
	if (parsed.type === "function") {
		return `${parsed.name}(${parsed.arg})`;
	}
	return parsed.value;
}

function isConditionFunction(name: string): name is ConditionFunction {
	return CONDITION_FUNCTIONS.includes(name as ConditionFunction);
}

export function formatConditionDisplay(part: ConditionPart): string {
	const left = serializeOperand(parseOperand(part.left));
	const op = OPERATOR_LABELS[part.operator];
	const right = serializeOperand(parseOperand(part.right));
	return `${left} ${op} ${right}`;
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
