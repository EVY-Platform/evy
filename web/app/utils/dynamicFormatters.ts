import type { DATA_EVY_Formatter } from "evy-types";
import type { EVYFunctionContext, EVYFunctionOutput } from "./datetime";
import { stripOptionalSurroundingQuotes } from "./datetime";
import { splitFunctionArguments } from "./functionArgs";

export type EVYFormatterDefinition = Pick<
	DATA_EVY_Formatter,
	"name" | "formatting_config" | "formatting"
>;

/**
 * Template mechanics for synced formatter rows. Evaluating a template needs the
 * full function table, so that lives in functions.ts - keeping this module a
 * leaf that functions.ts can import without a cycle.
 */

export const INPUT_PROP_PATTERN = /\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const INPUT_PROP_PATTERN_GLOBAL = new RegExp(INPUT_PROP_PATTERN, "g");

/** Walks a dot/bracket path (`items[0].price`) down an already-resolved object. */
export function resolvePathOnObject(
	root: Record<string, unknown> | undefined,
	path: string,
): unknown {
	return path
		.split(".")
		.flatMap((part) => part.split(/\[|\]/).filter(Boolean))
		.reduce<unknown>((current, part) => {
			if (Array.isArray(current)) {
				const index = Number(part);
				return Number.isInteger(index) ? current[index] : undefined;
			}
			if (!current || typeof current !== "object") return undefined;
			return (current as Record<string, unknown>)[part];
		}, root);
}

export function valueToString(value: unknown): string {
	if (value === undefined || value === null) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
}

function findTemplate(
	formatting: Record<string, string>,
	key: string,
): string | undefined {
	if (formatting[key] !== undefined) {
		return formatting[key];
	}
	return Object.entries(formatting).find(
		([candidateKey]) =>
			candidateKey.localeCompare(key, undefined, {
				sensitivity: "accent",
				usage: "search",
			}) === 0,
	)?.[1];
}

export function lookupFormatterTemplate(
	formatting: Record<string, string>,
	key: string,
	formatterName: string,
): string {
	const trimmedKey = key.trim();
	const template =
		findTemplate(formatting, trimmedKey) ??
		findTemplate(formatting, "default");
	if (template === undefined) {
		throw new Error(
			`Formatter ${formatterName}: no template for key '${trimmedKey}' and no default`,
		);
	}
	return template;
}

export function sanitizeFormatterTemplate(
	template: string,
	input: Record<string, unknown>,
): string {
	let sanitized = template.replace(
		INPUT_PROP_PATTERN_GLOBAL,
		(_match, fieldName: string) => valueToString(input[fieldName]).trim(),
	);
	sanitized = sanitized.replace(/ {2,}/g, " ");
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

export function normalizePriceInput(input: unknown): Record<string, unknown> {
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

/** Resolves a template binding: `input`/`input.x` against the formatter input, anything else against the host context. */
export function resolveBindingPath(
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
	return context?.resolvePath?.(trimmedPath);
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

	const number = Number(resolveBindingPath(path, context));
	if (!Number.isFinite(number)) {
		return { value: "" };
	}
	return { value: number.toFixed(fractionDigits) };
}
