export const CONDITION_FUNCTIONS = ["count", "length"] as const;
export type ConditionFunction = (typeof CONDITION_FUNCTIONS)[number];

export type ParsedOperand =
	| { type: "value"; value: string }
	| { type: "function"; name: ConditionFunction; arg: string };

function isConditionFunction(name: string): name is ConditionFunction {
	return CONDITION_FUNCTIONS.includes(name as ConditionFunction);
}

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
