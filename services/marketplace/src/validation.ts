/**
 * Runtime JSON Schema validation for marketplace-owned payloads.
 *
 * Marketplace data shapes are this service's own contract, not part of the
 * shared EVY types package: the core api forwards these payloads without
 * looking inside them, so the strict check has to happen here. Source of
 * truth is ./schema/*.schema.json.
 */

import {
	Ajv2020,
	type ErrorObject,
	type ValidateFunction,
} from "ajv/dist/2020";
import addFormats from "ajv-formats";
import itemSchema from "./schema/item.schema.json" with { type: "json" };
import lookupSchema from "./schema/lookup.schema.json" with { type: "json" };
import type {
	DATA_MARKETPLACE_Item,
	DATA_MARKETPLACE_Lookup,
} from "./schema/types";

export { itemSchema, lookupSchema };

let ajvInstance: InstanceType<typeof Ajv2020> | null = null;

function getAjv(): InstanceType<typeof Ajv2020> {
	if (!ajvInstance) {
		const instance = new Ajv2020({ allErrors: true, strict: false });
		addFormats(instance);
		ajvInstance = instance;
	}
	return ajvInstance;
}

/**
 * A oneOf union reports one failure per branch, so the same complaint repeats
 * many times. Dedupe and cap so the real cause stays readable. Mirrors the
 * shared package's formatting so error strings stay stable for callers.
 */
function formatAjvErrors(
	label: string,
	errors: ErrorObject[] | null | undefined,
): string {
	if (!errors?.length) return `${label} validation failed`;

	const seen = new Set<string>();
	for (const e of errors) {
		const path = e.instancePath === "" ? "(root)" : e.instancePath;
		seen.add(`${path}: ${e.message ?? "invalid"}`);
	}

	const MAX_REPORTED = 6;
	const parts = [...seen];
	const shown = parts.slice(0, MAX_REPORTED);
	const remaining = parts.length - shown.length;
	const suffix = remaining > 0 ? `; (+${remaining} more)` : "";
	return `${label} validation failed: ${shown.join("; ")}${suffix}`;
}

/** Compiles on first use so importing this module stays cheap. */
function makeValidator<T>(label: string, schema: object): (data: unknown) => T {
	let compiled: ValidateFunction<T> | null = null;
	return (data: unknown): T => {
		if (!compiled) compiled = getAjv().compile<T>(schema);
		if (!compiled(data)) {
			throw new Error(formatAjvErrors(label, compiled.errors));
		}
		return data as T;
	};
}

export const validateDataMarketplaceItem = makeValidator<DATA_MARKETPLACE_Item>(
	"MarketplaceItem",
	itemSchema,
);

export const validateDataMarketplaceLookup =
	makeValidator<DATA_MARKETPLACE_Lookup>("MarketplaceLookup", lookupSchema);
