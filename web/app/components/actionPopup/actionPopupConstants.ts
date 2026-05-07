import { ACTION_FUNCTIONS, FUNCTION_LABELS } from "../../utils/actionBranch";
import {
	COMPARISON_OPERATORS,
	OPERATOR_LABELS,
} from "../../utils/conditionExpression";
import type { PopoverOption } from "../PopoverSelect";

export const OPERATOR_OPTIONS: PopoverOption[] = COMPARISON_OPERATORS.map(
	(op) => ({
		value: op,
		label: OPERATOR_LABELS[op],
	}),
);

const FUNCTION_OPTIONS: PopoverOption[] = ACTION_FUNCTIONS.map((fn) => ({
	value: fn,
	label: FUNCTION_LABELS[fn],
}));

export const BRANCH_FUNCTION_OPTIONS: PopoverOption[] = [
	{ value: "", label: "--" },
	...FUNCTION_OPTIONS,
];

export const BOOLEAN_OPTIONS: PopoverOption[] = [
	{ value: "true", label: "true" },
	{ value: "false", label: "false" },
];
