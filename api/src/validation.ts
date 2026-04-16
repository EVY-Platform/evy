import {
	UI_ROW_TYPE_VALUES,
	type DATA_EVY_Data,
	type UI_Flow,
	type UI_Row,
} from "evy-types";
import { z } from "zod";

/**
 * JSON Schema `integer`: whole numbers only (no fractional part).
 */
export const zIntegerSchema = z.number().int();

/**
 * JSON Schema `number`: finite numeric values; allows integer literals and decimals.
 */
export const zNumberSchema = z.number().finite();

/**
 * Recursive JSON value matching `types/schema/common/json.schema.json` `JSONValue`.
 * Scalar numbers are validated as finite (covers both JSON Schema `integer` and `number` branches).
 */
export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
	z.union([
		z.null(),
		z.boolean(),
		z.string(),
		zNumberSchema,
		z.array(JsonValueSchema),
		z.record(z.string(), JsonValueSchema),
	]),
);

const DataPayloadObjectSchema = z.record(z.string(), JsonValueSchema);

export function formatZodErrors(issues: z.core.$ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
}

/**
 * Instants in JSON payloads use camelCase `*At` (e.g. `createdAt`) or legacy snake_case `*_timestamp`.
 * Add explicit exceptions here only when a field is an instant but does not match those patterns.
 */
const ISO_DATE_TIME_FIELD_NAME_EXCEPTIONS = new Set<string>([]);

/**
 * Whether a JSON object key should hold an ISO 8601 / RFC 3339 string (never a numeric timestamp).
 */
export function isIsoDateTimeFieldName(key: string): boolean {
	if (ISO_DATE_TIME_FIELD_NAME_EXCEPTIONS.has(key)) {
		return true;
	}
	if (key.endsWith("_timestamp")) {
		return true;
	}
	// camelCase instant suffix, length check avoids matching very short keys
	if (key.length >= 3 && key.endsWith("At")) {
		return true;
	}
	return false;
}

const zIsoDateTimeString = z.iso.datetime();

function throwDataIsoValidationError(path: string, reason: string): never {
	throw new Error(`Data validation failed: ${path}: ${reason}`);
}

/**
 * Walks arbitrary JSON under a data payload and enforces ISO date-time strings on
 * keys matched by {@link isIsoDateTimeFieldName}. Rejects finite numbers and non-string types for those keys.
 */
export function assertIsoDateTimeJsonFields(
	value: unknown,
	pathPrefix = "",
): void {
	if (value === null || typeof value !== "object") {
		return;
	}
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			assertIsoDateTimeJsonFields(
				value[index],
				pathPrefix ? `${pathPrefix}[${index}]` : `[${index}]`,
			);
		}
		return;
	}

	const record = value as Record<string, unknown>;
	for (const [key, child] of Object.entries(record)) {
		const path = pathPrefix ? `${pathPrefix}.${key}` : key;
		if (isIsoDateTimeFieldName(key)) {
			if (typeof child === "number" && Number.isFinite(child)) {
				throwDataIsoValidationError(
					path,
					"date-time fields must be ISO 8601 strings, not numeric timestamps",
				);
			}
			if (child === null || child === undefined) {
				throwDataIsoValidationError(
					path,
					"date-time field must be an ISO 8601 string",
				);
			}
			if (typeof child !== "string") {
				throwDataIsoValidationError(
					path,
					"date-time field must be an ISO 8601 string",
				);
			}
			const parsed = zIsoDateTimeString.safeParse(child);
			if (!parsed.success) {
				throwDataIsoValidationError(
					path,
					`expected ISO 8601 date-time string (${formatZodErrors(parsed.error.issues)})`,
				);
			}
		}
		assertIsoDateTimeJsonFields(child, path);
	}
}

/**
 * Schema for a single row action item
 */
const RowActionSchema = z.strictObject({
	condition: z.string(),
	false: z.string(),
	true: z.string(),
});

/**
 * Schema for row action configuration
 */
const RowActionsSchema = z.array(RowActionSchema);

/**
 * Recursive row schema that validates the full row structure including nested children
 */
export const RowSchema: z.ZodType<UI_Row> = z.lazy(() =>
	z.strictObject({
		id: z.uuid(),
		type: z.enum(UI_ROW_TYPE_VALUES),
		view: z.strictObject({
			content: z.looseObject({
				title: z.string(),
				children: z.array(RowSchema).optional(),
				child: RowSchema.optional(),
				segments: z.array(z.string()).optional(),
			}),
			data: z.string().optional(),
			max_lines: z.string().optional(),
		}),
		destination: z.string().optional(),
		actions: RowActionsSchema.default([]),
	}),
);

/**
 * Schema for a page within a flow
 */
export const PageSchema = z.strictObject({
	id: z.uuid(),
	title: z.string(),
	rows: z.array(RowSchema),
	footer: RowSchema.optional(),
});

/**
 * Schema for the complete flow data structure.
 * Pages may be an empty array per UI_Flow schema.
 */
const FlowDataSchema: z.ZodType<UI_Flow> = z.strictObject({
	id: z.uuid(),
	name: z.string().min(1, { error: "Flow name is required" }),
	pages: z.array(PageSchema),
});

/**
 * Validates non-SDUI `upsert` payloads: top-level object with JSON-serializable values
 * (`JSONValue`), with finite numeric scalars only.
 */
export function validateDataPayload(data: unknown): DATA_EVY_Data["data"] {
	const result = DataPayloadObjectSchema.safeParse(data);
	if (!result.success) {
		throw new Error(
			`Data validation failed: ${formatZodErrors(result.error.issues)}`,
		);
	}
	assertIsoDateTimeJsonFields(result.data);
	return result.data as DATA_EVY_Data["data"];
}

export function validateFlowData(data: unknown): UI_Flow {
	const result = FlowDataSchema.safeParse(data);

	if (!result.success) {
		throw new Error(
			`Flow validation failed: ${formatZodErrors(result.error.issues)}`,
		);
	}

	return result.data;
}
