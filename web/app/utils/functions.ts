import { evaluateConditionForPreview } from "./conditionExpression";
import type { EVYFunctionOutput } from "./datetime";
import {
	type EVYFunctionContext,
	evyFormatDatetime,
	stripOptionalSurroundingQuotes,
} from "./datetime";
import {
	evyFormatDecimal,
	INPUT_PROP_PATTERN,
	lookupFormatterTemplate,
	normalizePriceInput,
	resolveBindingPath,
	resolvePathOnObject,
	sanitizeFormatterTemplate,
	valueToString,
} from "./dynamicFormatters";
import { splitFunctionArguments } from "./functionArgs";

export type { EVYFunctionContext };

type EVYFunctionHandler = (
	args: string,
	context?: EVYFunctionContext,
) => EVYFunctionOutput | null;

const WRAPPED_FUNCTION_CALL_PATTERN =
	/\{([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)\}/;
const FUNCTION_CALL_PATTERN = /([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)/;

/** Web intentionally returns doc-shaped placeholders for functions that need runtime data. */
function evyCount(): EVYFunctionOutput {
	return { value: "1" };
}

function evyLength(): EVYFunctionOutput {
	return { value: "1" };
}

/**
 * The builder does not evaluate collections, it just shows what a row would read from. Split
 * on top-level commas only: the collection argument can itself be a call, as in
 * `findFirst(sort(messages, desc, createdAt), …)`, and a naive split would render
 * "sort(messages" as the source.
 */
function evyCollectionPlaceholder(args: string): EVYFunctionOutput {
	const [data] = splitFunctionArguments(args);
	return { value: data?.trim() ?? "" };
}

/**
 * Runs a synced formatter template. Templates may call any built-in, so the
 * function table is reused here rather than forked - matching iOS, which
 * evaluates templates through its own interpreter.
 */
function evaluateFormatterExpression(
	expression: string,
	context: EVYFunctionContext,
): string {
	let text = expression;
	let safety = 0;

	while (safety++ < 50) {
		// A braced call consumes its braces; a bare one does not.
		const wrappedFnMatch = WRAPPED_FUNCTION_CALL_PATTERN.exec(text);
		const resolvedWrapped = wrappedFnMatch
			? callFunction(wrappedFnMatch[1], wrappedFnMatch[2], context)
			: null;
		if (wrappedFnMatch && resolvedWrapped) {
			text = replaceMatch(text, wrappedFnMatch, resolvedWrapped);
			continue;
		}

		const inputPropMatch = INPUT_PROP_PATTERN.exec(text);
		if (inputPropMatch) {
			text = text.replace(
				inputPropMatch[0],
				valueToString(
					resolveBindingPath(`input.${inputPropMatch[1]}`, context),
				),
			);
			continue;
		}

		const fnMatch = FUNCTION_CALL_PATTERN.exec(text);
		const resolvedFn = fnMatch
			? callFunction(fnMatch[1], fnMatch[2], context)
			: null;
		if (fnMatch && resolvedFn) {
			text = replaceMatch(text, fnMatch, resolvedFn);
			continue;
		}

		break;
	}

	return text.replace(/\\n/g, "\n");
}

function replaceMatch(
	text: string,
	match: RegExpExecArray,
	output: EVYFunctionOutput,
): string {
	const resolved = `${output.prefix ?? ""}${output.value}${output.suffix ?? ""}`;
	return `${text.slice(0, match.index)}${resolved}${text.slice(match.index + match[0].length)}`;
}

export function evaluateDynamicFormatter(
	formatterName: string,
	args: string,
	context?: EVYFunctionContext,
): EVYFunctionOutput {
	const formatter = context?.formatters?.find(
		(candidate) => candidate.name === formatterName,
	);
	if (!formatter) {
		throw new Error(`Formatter ${formatterName} is not available`);
	}

	const resolvedArg = context?.resolvePath?.(args.trim());
	const argValue = resolvedArg === undefined ? context?.input : resolvedArg;

	// Currency is the one formatter whose input shape and editing representation
	// are not expressible in a synced template.
	let input: Record<string, unknown>;
	if (formatterName === "formatCurrency") {
		input = normalizePriceInput(argValue);
		const rawValue = valueToString(input.value).trim();
		if (context?.editing) return { value: rawValue };
		if (rawValue === "") return { value: "" };
	} else {
		input =
			argValue && typeof argValue === "object" && !Array.isArray(argValue)
				? (argValue as Record<string, unknown>)
				: {};
	}

	const formatterContext: EVYFunctionContext = { ...context, input };
	const template = lookupFormatterTemplate(
		formatter.formatting,
		evaluateFormatterExpression(
			formatter.formatting_config,
			formatterContext,
		),
		formatterName,
	);
	return {
		value: evaluateFormatterExpression(
			sanitizeFormatterTemplate(template, input),
			formatterContext,
		),
	};
}

function makeDynamicFormatter(
	formatterName: string,
	fallback: EVYFunctionOutput,
): EVYFunctionHandler {
	return (args, context) => {
		if (!context?.formatters?.length) return fallback;
		try {
			return evaluateDynamicFormatter(formatterName, args, {
				...context,
				resolvePath: context.resolvePath ?? resolveMockPath,
			});
		} catch {
			return fallback;
		}
	};
}

const evyFormatCurrency = makeDynamicFormatter("formatCurrency", {
	value: "1.00",
	prefix: "$",
});

const evyFormatAddress = makeDynamicFormatter("formatAddress", {
	value: "1 Main Street, 2000 Sydney NSW",
});

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

function resolveMockPath(path: string): unknown {
	return resolvePathOnObject(previewMockData, path);
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

function evyFormatAddressLine1(): EVYFunctionOutput {
	return { value: "1 Main Street" };
}

function evyFormatAddressLine2(): EVYFunctionOutput {
	return { value: "Sydney, NSW 2000" };
}

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
	findFirst: evyCollectionPlaceholder,
	sort: evyCollectionPlaceholder,
	formatCurrency: evyFormatCurrency,
	formatDimension: evyFormatDimension,
	formatWeight: evyFormatWeight,
	formatAddress: evyFormatAddress,
	formatAddressLine1: evyFormatAddressLine1,
	formatAddressLine2: evyFormatAddressLine2,
	formatDecimal: evyFormatDecimal,
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
