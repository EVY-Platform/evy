import {
	ACTION_FUNCTIONS,
	COMPARISON_OPERATORS,
	FUNCTION_LABELS,
	OPERATOR_LABELS,
} from "../../utils/actionHelpers";
import type { PopoverOption } from "../PopoverSelect";

export const OPERATOR_OPTIONS: PopoverOption[] = COMPARISON_OPERATORS.map(
	(op) => ({
		value: op,
		label: OPERATOR_LABELS[op],
	}),
);

export const FUNCTION_OPTIONS: PopoverOption[] = ACTION_FUNCTIONS.map((fn) => ({
	value: fn,
	label: FUNCTION_LABELS[fn],
}));

export const BOOLEAN_OPTIONS: PopoverOption[] = [
	{ value: "true", label: "true" },
	{ value: "false", label: "false" },
];
