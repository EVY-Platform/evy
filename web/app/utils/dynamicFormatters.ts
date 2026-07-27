import type { DATA_EVY_Formatter } from "evy-types";
import type { EVYFunctionContext, EVYFunctionOutput } from "./datetime";
import { stripOptionalSurroundingQuotes } from "./datetime";
import { splitFunctionArguments } from "./functionArgs";

export type EVYFormatterDefinition = Pick<
	DATA_EVY_Formatter,
	"name" | "formatting_config" | "formatting"
>;

const WRAPPED_FUNCTION_CALL_PATTERN =
	/\{([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)\}/;
const FUNCTION_CALL_PATTERN = /([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)/;
const INPUT_PROP_PATTERN = /\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}/;

function splitDotAndBracketPath(path: string): string[] {
	return path
		.split(".")
		.flatMap((part) => part.split(/\[|\]/).filter(Boolean));
}

function resolvePathOnObject(
	root: Record<string, unknown>,
	path: string,
): unknown {
	return splitDotAndBracketPath(path).reduce<unknown>((current, part) => {
		if (Array.isArray(current)) {
			const index = Number(part);
			return Number.isInteger(index) ? current[index] : undefined;
		}
		if (!current || typeof current !== "object") return undefined;
		return (current as Record<string, unknown>)[part];
	}, root);
}

function valueToString(value: unknown): string {
	if (value === undefined || value === null) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
}

export function lookupFormatterTemplate(
	formatting: Record<string, string>,
	key: string,
	formatterName: string,
): string {
	const trimmedKey = key.trim();
	if (formatting[trimmedKey]) {
		return formatting[trimmedKey];
	}
	const caseInsensitiveMatch = Object.entries(formatting).find(
		([candidateKey]) =>
			candidateKey.localeCompare(trimmedKey, undefined, {
				sensitivity: "accent",
				usage: "search",
			}) === 0,
	);
	if (caseInsensitiveMatch) {
		return caseInsensitiveMatch[1];
	}
	if (formatting.default) {
		return formatting.default;
	}
	const defaultMatch = Object.entries(formatting).find(
		([candidateKey]) => candidateKey.toLowerCase() === "default",
	);
	if (defaultMatch) {
		return defaultMatch[1];
	}
	throw new Error(
		`Formatter ${formatterName}: no template for key '${trimmedKey}' and no default`,
	);
}

export function sanitizeFormatterTemplate(
	template: string,
	input: Record<string, unknown>,
): string {
	let sanitized = template.replace(
		/\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
		(_match, fieldName: string) => {
			const fieldValue = valueToString(input[fieldName]).trim();
			return fieldValue;
		},
	);
	while (sanitized.includes("  ")) {
		sanitized = sanitized.replaceAll("  ", " ");
	}
	while (sanitized.includes(", ,")) {
		sanitized = sanitized.replaceAll(", ,", ", ");
	}
	sanitized = sanitized.replaceAll(" ,", ",");
	sanitized = sanitized.trim();
	sanitized = sanitized.replace(/^,+|,+$/g, "").trim();
	if (/^[\s,]*$/.test(sanitized)) {
		return "";
	}
	return sanitized;
}

function normalizePriceInput(input: unknown): Record<string, unknown> {
	if (input && typeof input === "object" && !Array.isArray(input)) {
		const record = input as Record<string, unknown>;
		if (record.currency !== undefined) {
			return record;
		}
		return { ...record, currency: "AUD" };
	}
	if (typeof input === "number" || typeof input === "string") {
		return { currency: "AUD", value: input };
	}
	return { currency: "AUD", value: "" };
}

function resolveBindingPath(
	path: string,
	context?: EVYFunctionContext,
): unknown {
	const trimmedPath = path.trim();
	if (trimmedPath === "input" && context?.input) {
		return context.input;
	}
	if (trimmedPath.startsWith("input.") && context?.input) {
		return resolvePathOnObject(
			context.input,
			trimmedPath.slice("input.".length),
		);
	}
	if (context?.resolvePath) {
		return context.resolvePath(trimmedPath);
	}
	return undefined;
}

export function evyFormatDecimal(
	args: string,
	context?: EVYFunctionContext,
): EVYFunctionOutput {
	const parts = splitFunctionArguments(args);
	const path = parts[0]?.trim() ?? "";
	const placesRaw = parts[1]
		? stripOptionalSurroundingQuotes(parts[1].trim())
		: "2";
	const places = Number.parseInt(placesRaw, 10);
	const fractionDigits =
		Number.isInteger(places) && places >= 0 && places <= 20 ? places : 2;

	let resolvedValue: unknown;
	if (path.startsWith("input.") && context?.input) {
		resolvedValue = resolvePathOnObject(
			context.input,
			path.slice("input.".length),
		);
	} else if (context?.resolveBinding) {
		const bound = context.resolveBinding(path);
		resolvedValue = bound === undefined ? undefined : bound;
	} else {
		resolvedValue = resolveBindingPath(path, context);
	}

	const number = Number(resolvedValue);
	if (!Number.isFinite(number)) {
		return { value: "" };
	}
	return { value: number.toFixed(fractionDigits) };
}

const formatterExpressionHandlers: Record<
	string,
	(args: string, context?: EVYFunctionContext) => EVYFunctionOutput
> = {
	formatDecimal: evyFormatDecimal,
};

function evaluateFormatterExpression(
	expression: string,
	context?: EVYFunctionContext,
): string {
	let text = expression;
	let safety = 0;

	while (safety++ < 50) {
		const wrappedFnMatch = WRAPPED_FUNCTION_CALL_PATTERN.exec(text);
		if (wrappedFnMatch) {
			const handler = formatterExpressionHandlers[wrappedFnMatch[1]];
			if (handler) {
				const result = handler(wrappedFnMatch[2], context);
				const resolved = `${result.prefix ?? ""}${result.value}${result.suffix ?? ""}`;
				text = `${text.slice(0, wrappedFnMatch.index)}${resolved}${text.slice(wrappedFnMatch.index + wrappedFnMatch[0].length)}`;
				continue;
			}
		}

		const inputPropMatch = INPUT_PROP_PATTERN.exec(text);
		if (inputPropMatch) {
			const inner = `input.${inputPropMatch[1]}`;
			const resolved = context?.resolveBinding?.(inner) ?? "";
			text = text.replace(inputPropMatch[0], resolved);
			continue;
		}

		const fnMatch = FUNCTION_CALL_PATTERN.exec(text);
		if (fnMatch) {
			const handler = formatterExpressionHandlers[fnMatch[1]];
			if (handler) {
				const result = handler(fnMatch[2], context);
				const resolved = `${result.prefix ?? ""}${result.value}${result.suffix ?? ""}`;
				text = `${text.slice(0, fnMatch.index)}${resolved}${text.slice(fnMatch.index + fnMatch[0].length)}`;
				continue;
			}
		}

		break;
	}

	return text.replace(/\\n/g, "\n");
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

	let inputValue = context?.resolvePath?.(args.trim());
	if (inputValue === undefined && context?.input) {
		inputValue = context.input;
	}
	if (formatterName === "formatCurrency") {
		const price = normalizePriceInput(inputValue);
		if (context?.editing) {
			return { value: valueToString(price.value).trim() };
		}
		if (valueToString(price.value).trim() === "") {
			return { value: "" };
		}
		const formatterContext: EVYFunctionContext = {
			...context,
			input: price,
		};
		formatterContext.resolveBinding = (path) => {
			const resolved = resolveBindingPath(path, formatterContext);
			return resolved === undefined ? undefined : valueToString(resolved);
		};
		const configKey = evaluateFormatterExpression(
			formatter.formatting_config,
			formatterContext,
		);
		const template = lookupFormatterTemplate(
			formatter.formatting,
			configKey,
			formatterName,
		);
		const sanitizedTemplate = sanitizeFormatterTemplate(template, price);
		return {
			value: evaluateFormatterExpression(
				sanitizedTemplate,
				formatterContext,
			),
		};
	}

	const address =
		inputValue &&
		typeof inputValue === "object" &&
		!Array.isArray(inputValue)
			? (inputValue as Record<string, unknown>)
			: {};
	const formatterContext: EVYFunctionContext = {
		...context,
		input: address,
	};
	formatterContext.resolveBinding = (path) => {
		const resolved = resolveBindingPath(path, formatterContext);
		return resolved === undefined ? undefined : valueToString(resolved);
	};
	const configKey = evaluateFormatterExpression(
		formatter.formatting_config,
		formatterContext,
	);
	const template = lookupFormatterTemplate(
		formatter.formatting,
		configKey,
		formatterName,
	);
	const sanitizedTemplate = sanitizeFormatterTemplate(template, address);
	return {
		value: evaluateFormatterExpression(sanitizedTemplate, formatterContext),
	};
}
