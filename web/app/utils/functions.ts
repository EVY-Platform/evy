import { evaluateConditionForPreview } from "./conditionExpression";
import {
	type EVYFunctionContext,
	type EVYFunctionOutput,
	evyFormatDatetime,
	stripOptionalSurroundingQuotes,
} from "./datetime";
import { splitFunctionArguments } from "./functionArgs";

export type { EVYFunctionContext, EVYFunctionOutput };

type EVYFunctionHandler = (
	args: string,
	context?: EVYFunctionContext,
) => EVYFunctionOutput | null;

/** Web intentionally returns doc-shaped placeholders for functions that need runtime data. */
function evyCount(): EVYFunctionOutput {
	return { value: "1" };
}

function evyLength(): EVYFunctionOutput {
	return { value: "1" };
}

function evyFindFirst(args: string): EVYFunctionOutput {
	const [data] = args.split(",");
	return { value: data?.trim() ?? "" };
}

function evySort(args: string): EVYFunctionOutput {
	const [data] = args.split(",");
	return { value: data?.trim() ?? "" };
}

function evyFormatCurrency(): EVYFunctionOutput {
	return { value: "1.00", prefix: "$" };
}

const fallbackDimensionOutput: EVYFunctionOutput = {
	value: "100",
	suffix: "mm",
};

const previewDimensionMillimetres = 23240;

const previewDimensions = {
	width: previewDimensionMillimetres,
	height: previewDimensionMillimetres,
	length: previewDimensionMillimetres,
};

const previewMockData = {
	item: {
		...previewDimensions,
		dimensions: previewDimensions,
	},
	items: [previewDimensions],
	...previewDimensions,
};

function splitDotAndBracketPath(path: string): string[] {
	return path
		.split(".")
		.flatMap((part) => part.split(/\[|\]/).filter(Boolean));
}

function resolveMockPath(path: string): unknown {
	return splitDotAndBracketPath(path).reduce<unknown>((current, part) => {
		if (Array.isArray(current)) {
			const index = Number(part);
			return Number.isInteger(index) ? current[index] : undefined;
		}
		if (!current || typeof current !== "object") return undefined;
		return (current as Record<string, unknown>)[part];
	}, previewMockData);
}

function formatDimensionMillimetres(mm: number): EVYFunctionOutput {
	if (mm > 1000) return { value: String(Math.trunc(mm / 1000)), suffix: "m" };
	if (mm > 100) return { value: String(Math.trunc(mm / 10)), suffix: "cm" };
	return { value: String(mm), suffix: "mm" };
}

function evyFormatDimension(
	args: string,
	context?: EVYFunctionContext,
): EVYFunctionOutput {
	const trimmedArgs = args.trim();
	if (!trimmedArgs) return fallbackDimensionOutput;

	const value =
		trimmedArgs === "$datum"
			? context?.datum
			: resolveMockPath(trimmedArgs);
	const rawValue = value ?? trimmedArgs;
	const trimmedValue = String(rawValue)
		.trim()
		.replace(/^['"]|['"]$/g, "");
	if (!trimmedValue) return { value: "" };

	const mm = Number(trimmedValue);
	if (!Number.isInteger(mm)) return fallbackDimensionOutput;
	return formatDimensionMillimetres(mm);
}

function evyFormatWeight(): EVYFunctionOutput {
	return { value: "500", suffix: "g" };
}

function evyFormatAddress(): EVYFunctionOutput {
	return { value: "1 Main Street, 2000 Sydney NSW" };
}

function evyFormatAddressLine1(): EVYFunctionOutput {
	return { value: "1 Main Street" };
}

function evyFormatAddressLine2(): EVYFunctionOutput {
	return { value: "Sydney, NSW 2000" };
}

const evyFormatDecimalStub = (): EVYFunctionOutput => ({ value: "20.04" });
const evyFormatMetricLengthStub = (): EVYFunctionOutput => ({
	value: "23.24",
	suffix: "m",
});
const evyFormatImperialLengthStub = (): EVYFunctionOutput => ({
	value: "13.88",
	suffix: "ft",
});
const evyFormatDurationStub = (): EVYFunctionOutput => ({
	value: "15 minutes",
});

// Web preview uses a minimal condition evaluator; unknown bindings resolve as empty/zero.
function resolvePreviewConditionOperand(operand: string): string {
	const trimmed = operand.trim();
	const countMatch = /^count\((.*)\)$/.exec(trimmed);
	if (countMatch) {
		const inner = countMatch[1].trim();
		const value = resolveMockPath(inner);
		if (Array.isArray(value)) {
			return String(value.length);
		}
		return "0";
	}
	const unquoted = stripOptionalSurroundingQuotes(trimmed);
	// A quoted operand is a string literal, never a path.
	if (unquoted !== trimmed) {
		return unquoted;
	}
	const mockValue = resolveMockPath(unquoted);
	if (Array.isArray(mockValue)) {
		return String(mockValue.length);
	}
	if (mockValue !== undefined && mockValue !== null) {
		return String(mockValue);
	}
	return unquoted;
}

function evyIfStub(args: string): EVYFunctionOutput {
	const parts = splitFunctionArguments(args);
	if (parts.length !== 3) {
		return { value: "" };
	}
	const [condition, trueBranch, falseBranch] = parts;
	const conditionMet = evaluateConditionForPreview(
		condition.trim(),
		resolvePreviewConditionOperand,
	);
	const selected = conditionMet ? trueBranch : falseBranch;
	const trimmed = selected.trim();
	if (trimmed === "") {
		return { value: "" };
	}
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return { value: stripOptionalSurroundingQuotes(trimmed) };
	}
	return { value: trimmed };
}

const functionHandlers: Record<string, EVYFunctionHandler> = {
	count: evyCount,
	length: evyLength,
	findFirst: evyFindFirst,
	sort: evySort,
	formatCurrency: evyFormatCurrency,
	formatDimension: evyFormatDimension,
	formatWeight: evyFormatWeight,
	formatAddress: evyFormatAddress,
	formatAddressLine1: evyFormatAddressLine1,
	formatAddressLine2: evyFormatAddressLine2,
	formatDecimal: evyFormatDecimalStub,
	formatMetricLength: evyFormatMetricLengthStub,
	formatImperialLength: evyFormatImperialLengthStub,
	formatDuration: evyFormatDurationStub,
	formatDatetime: evyFormatDatetime,
	if: evyIfStub,
};

export function callFunction(
	name: string,
	args = "",
	context?: EVYFunctionContext,
): EVYFunctionOutput | null {
	const handler = functionHandlers[name];
	if (!handler) return null;
	return handler(args, context);
}
