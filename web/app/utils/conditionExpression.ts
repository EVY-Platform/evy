import type { ServiceResource } from "../api/sync";
import { parseOperand } from "./actionOperands";
import {
	formatResourcePathForDisplay,
	resourceNameById,
} from "./resourcePathDisplay";
import { unwrapOptionalBraces } from "./unwrapBraces";

export const COMPARISON_OPERATORS = ["==", "!=", ">", "<", ">=", "<="] as const;
type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
	"==": "equals",
	"!=": "not equals",
	">": ">",
	"<": "<",
	">=": ">=",
	"<=": "<=",
};

export type LogicalOperator = "and" | "or";

export type ConditionLeaf = {
	type: "leaf";
	left: string;
	operator: ComparisonOperator;
	right: string;
};

export type ConditionGroup = {
	type: "group";
	logicalOperator: LogicalOperator;
	children: ConditionExpression[];
};

export type ConditionExpression = ConditionLeaf | ConditionGroup;

export function parseCondition(
	conditionString: string,
): ConditionExpression | null {
	const trimmed = conditionString.trim();
	if (!trimmed) return null;

	const inner = unwrapOptionalBraces(trimmed);
	if (!inner) return null;

	const tokens = tokenize(inner);
	if (tokens.length === 0) return null;

	const result = parseOrExpression(tokens, { pos: 0 });
	return result;
}

type TokenCursor = { pos: number };

function tokenize(input: string): string[] {
	const tokens: string[] = [];
	const operators = ["&&", "||", ">=", "<=", "!=", "=="];
	const singleChars = new Set(["(", ")", ">", "<"]);
	const opStartChars = new Set("&|!>=<");

	let i = 0;
	while (i < input.length) {
		if (input[i] === " " || input[i] === "\t") {
			i++;
			continue;
		}
		if (singleChars.has(input[i])) {
			tokens.push(input[i]);
			i++;
			continue;
		}
		let matched = false;
		for (const op of operators) {
			if (input.startsWith(op, i)) {
				tokens.push(op);
				i += op.length;
				matched = true;
				break;
			}
		}
		if (matched) continue;

		let word = "";
		while (i < input.length) {
			const ch = input[i];
			if (ch === " " || ch === "\t" || singleChars.has(ch)) break;
			// Check if this position starts a multi-char operator
			if (opStartChars.has(ch)) {
				let isOp = false;
				for (const op of operators) {
					if (input.startsWith(op, i)) {
						isOp = true;
						break;
					}
				}
				if (isOp) break;
			}
			word += ch;
			i++;
		}

		if (i < input.length && input[i] === "(") {
			word += "(";
			i++;
			let depth = 1;
			while (i < input.length && depth > 0) {
				if (input[i] === "(") depth++;
				if (input[i] === ")") depth--;
				word += input[i];
				i++;
			}
			tokens.push(word);
		} else if (word) {
			tokens.push(word);
		}
	}
	return tokens;
}

function isComparisonOp(token: string): token is ComparisonOperator {
	return (COMPARISON_OPERATORS as readonly string[]).includes(token);
}

function parseOrExpression(
	tokens: string[],
	cursor: TokenCursor,
): ConditionExpression | null {
	const children: ConditionExpression[] = [];
	const first = parseAndExpression(tokens, cursor);
	if (!first) return null;
	children.push(first);

	while (cursor.pos < tokens.length && tokens[cursor.pos] === "||") {
		cursor.pos++;
		const next = parseAndExpression(tokens, cursor);
		if (!next) break;
		children.push(next);
	}

	if (children.length === 1) return children[0];
	return { type: "group", logicalOperator: "or", children };
}

function parseAndExpression(
	tokens: string[],
	cursor: TokenCursor,
): ConditionExpression | null {
	const children: ConditionExpression[] = [];
	const first = parsePrimaryExpression(tokens, cursor);
	if (!first) return null;
	children.push(first);

	while (cursor.pos < tokens.length && tokens[cursor.pos] === "&&") {
		cursor.pos++;
		const next = parsePrimaryExpression(tokens, cursor);
		if (!next) break;
		children.push(next);
	}

	if (children.length === 1) return children[0];
	return { type: "group", logicalOperator: "and", children };
}

function parsePrimaryExpression(
	tokens: string[],
	cursor: TokenCursor,
): ConditionExpression | null {
	if (cursor.pos >= tokens.length) return null;

	if (tokens[cursor.pos] === "(") {
		cursor.pos++;
		const inner = parseOrExpression(tokens, cursor);
		if (cursor.pos < tokens.length && tokens[cursor.pos] === ")") {
			cursor.pos++;
		}
		return inner;
	}

	return parseAtomicComparison(tokens, cursor);
}

function parseAtomicComparison(
	tokens: string[],
	cursor: TokenCursor,
): ConditionLeaf | null {
	if (cursor.pos >= tokens.length) return null;
	const left = tokens[cursor.pos];
	if (
		left === "(" ||
		left === ")" ||
		left === "&&" ||
		left === "||" ||
		isComparisonOp(left)
	)
		return null;
	cursor.pos++;

	if (cursor.pos >= tokens.length || !isComparisonOp(tokens[cursor.pos]))
		return null;
	const operator = tokens[cursor.pos] as ComparisonOperator;
	cursor.pos++;

	if (cursor.pos >= tokens.length) return null;
	const right = tokens[cursor.pos];
	if (
		right === "(" ||
		right === ")" ||
		right === "&&" ||
		right === "||" ||
		isComparisonOp(right)
	)
		return null;
	cursor.pos++;

	return { type: "leaf", left, operator, right };
}

export function serializeCondition(
	expression: ConditionExpression | null,
): string {
	if (!expression) return "";
	return `{${serializeExpressionInner(expression)}}`;
}

function serializeExpressionInner(expr: ConditionExpression): string {
	if (expr.type === "leaf") {
		return `${expr.left} ${expr.operator} ${expr.right}`;
	}
	const sep = expr.logicalOperator === "and" ? " && " : " || ";
	const parts = expr.children.map((child) => {
		if (
			child.type === "group" &&
			child.logicalOperator !== expr.logicalOperator
		) {
			return `(${serializeExpressionInner(child)})`;
		}
		return serializeExpressionInner(child);
	});
	return parts.join(sep);
}

type ConditionSummaryLine = {
	prefix: string;
	text: string;
};

/** Flatten an expression tree into display lines for the configuration summary. */
export function formatExpressionSummary(
	expr: ConditionExpression | null,
	serviceResources: ServiceResource[] = [],
): ConditionSummaryLine[] {
	if (!expr) return [];
	const resourceNamesById = resourceNameById(serviceResources);
	if (expr.type === "leaf") {
		return [{ prefix: "", text: formatLeafDisplay(expr, resourceNamesById) }];
	}
	return formatGroupSummary(expr, true, resourceNamesById);
}

function formatLeafDisplay(
	leaf: ConditionLeaf,
	resourceNamesById: Map<string, string>,
): string {
	const left = formatOperandDisplay(leaf.left, resourceNamesById);
	const op = OPERATOR_LABELS[leaf.operator];
	const right = formatOperandDisplay(leaf.right, resourceNamesById);
	return `${left} ${op} ${right}`;
}

function formatOperandDisplay(
	operand: string,
	resourceNamesById: Map<string, string>,
): string {
	const parsed = parseOperand(operand);
	if (parsed.type === "function") {
		return `${parsed.name}(${formatResourcePathForDisplay(parsed.arg, resourceNamesById)})`;
	}
	return formatResourcePathForDisplay(parsed.value, resourceNamesById);
}

function formatGroupSummary(
	group: ConditionGroup,
	isTopLevel: boolean,
	resourceNamesById: Map<string, string>,
): ConditionSummaryLine[] {
	const lines: ConditionSummaryLine[] = [];
	const keyword = group.logicalOperator === "and" ? "and" : "or";

	for (let i = 0; i < group.children.length; i++) {
		const child = group.children[i];
		const prefix = i === 0 && isTopLevel ? "" : keyword;

		if (child.type === "leaf") {
			lines.push({ prefix, text: formatLeafDisplay(child, resourceNamesById) });
		} else {
			const nested = formatGroupInline(child, resourceNamesById);
			lines.push({ prefix, text: nested });
		}
	}
	return lines;
}

function formatGroupInline(
	group: ConditionGroup,
	resourceNamesById: Map<string, string>,
): string {
	const keyword = group.logicalOperator === "and" ? " and " : " or ";
	const parts = group.children.map((child) => {
		if (child.type === "leaf") {
			return formatLeafDisplay(child, resourceNamesById);
		}
		return `(${formatGroupInline(child, resourceNamesById)})`;
	});
	return parts.join(keyword);
}

/** Create an empty leaf for use as a placeholder in the editor. */
export function emptyLeaf(): ConditionLeaf {
	return { type: "leaf", left: "", operator: "==", right: "" };
}
