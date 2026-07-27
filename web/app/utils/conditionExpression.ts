import type { ServiceResource } from "../types/resources";
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

/** A bare `true`/`false`, valid standalone and as an atom inside a group. */
type ConditionBoolean = {
	type: "boolean";
	value: boolean;
};

export type ConditionExpression =
	| ConditionLeaf
	| ConditionGroup
	| ConditionBoolean;

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
			// A quoted run is literal text: spaces and operator characters
			// inside it belong to the operand, not to the token stream.
			if (ch === '"') {
				word += ch;
				i++;
				while (i < input.length && input[i] !== '"') {
					word += input[i];
					i++;
				}
				if (i < input.length) {
					word += input[i];
					i++;
				}
				continue;
			}
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

	const booleanLiteral = parseBooleanLiteral(tokens, cursor);
	if (booleanLiteral) return booleanLiteral;

	return parseAtomicComparison(tokens, cursor);
}

function parseBooleanLiteral(
	tokens: string[],
	cursor: TokenCursor,
): ConditionBoolean | null {
	const token = tokens[cursor.pos];
	if (token !== "true" && token !== "false") return null;
	// `true == x` compares against the word `true`, which is how iOS resolves
	// an operand in that position. Only a bare boolean is a boolean node.
	if (isComparisonOp(tokens[cursor.pos + 1] ?? "")) return null;
	cursor.pos++;
	return { type: "boolean", value: token === "true" };
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

function compareOperandValues(
	operator: ComparisonOperator,
	left: string,
	right: string,
): boolean {
	const leftTrimmed = left.trim();
	const rightTrimmed = right.trim();
	const leftNumber = Number(leftTrimmed);
	const rightNumber = Number(rightTrimmed);
	const bothNumeric =
		leftTrimmed.length > 0 &&
		rightTrimmed.length > 0 &&
		!Number.isNaN(leftNumber) &&
		!Number.isNaN(rightNumber);

	if (bothNumeric) {
		switch (operator) {
			case "==":
				return leftNumber === rightNumber;
			case "!=":
				return leftNumber !== rightNumber;
			case ">":
				return leftNumber > rightNumber;
			case "<":
				return leftNumber < rightNumber;
			case ">=":
				return leftNumber >= rightNumber;
			case "<=":
				return leftNumber <= rightNumber;
		}
	}

	switch (operator) {
		case "==":
			return leftTrimmed === rightTrimmed;
		case "!=":
			return leftTrimmed !== rightTrimmed;
		default:
			return false;
	}
}

function evaluateConditionExpression(
	expression: ConditionExpression,
	resolveOperand: (operand: string) => string,
): boolean {
	if (expression.type === "boolean") {
		return expression.value;
	}

	if (expression.type === "leaf") {
		const left = resolveOperand(expression.left);
		const right = resolveOperand(expression.right);
		return compareOperandValues(expression.operator, left, right);
	}

	const results = expression.children.map((child) =>
		evaluateConditionExpression(child, resolveOperand),
	);
	if (expression.logicalOperator === "and") {
		return results.every(Boolean);
	}
	return results.some(Boolean);
}

/** Minimal boolean evaluation for web preview (not full iOS interpreter semantics). */
export function evaluateConditionForPreview(
	conditionString: string,
	resolveOperand: (operand: string) => string,
): boolean {
	const expression = parseCondition(conditionString);
	if (!expression) {
		return false;
	}
	return evaluateConditionExpression(expression, resolveOperand);
}

export function serializeCondition(
	expression: ConditionExpression | null,
): string {
	if (!expression) return "";
	return `{${serializeExpressionInner(expression)}}`;
}

function serializeExpressionInner(expr: ConditionExpression): string {
	if (expr.type === "boolean") {
		return expr.value ? "true" : "false";
	}
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
	if (expr.type === "group") {
		return formatGroupSummary(expr, true, resourceNamesById);
	}
	return [{ prefix: "", text: formatAtomDisplay(expr, resourceNamesById) }];
}

/** A leaf or a bare boolean — anything that is one summary line on its own. */
function formatAtomDisplay(
	atom: ConditionLeaf | ConditionBoolean,
	resourceNamesById: Map<string, string>,
): string {
	if (atom.type === "boolean") {
		return atom.value ? "always true" : "always false";
	}
	return formatLeafDisplay(atom, resourceNamesById);
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

		if (child.type === "group") {
			const nested = formatGroupInline(child, resourceNamesById);
			lines.push({ prefix, text: nested });
		} else {
			lines.push({
				prefix,
				text: formatAtomDisplay(child, resourceNamesById),
			});
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
		if (child.type === "group") {
			return `(${formatGroupInline(child, resourceNamesById)})`;
		}
		return formatAtomDisplay(child, resourceNamesById);
	});
	return parts.join(keyword);
}

/** Create an empty leaf for use as a placeholder in the editor. */
export function emptyLeaf(): ConditionLeaf {
	return { type: "leaf", left: "", operator: "==", right: "" };
}
