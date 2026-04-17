import type { DATA_EVY_Data } from "evy-types";
import { z } from "zod";

const zNumberSchema = z.number().finite();

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
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

function formatZodErrors(issues: z.core.$ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
}

function isIsoDateTimeFieldName(key: string): boolean {
	return key.endsWith("_timestamp") || (key.length >= 3 && key.endsWith("At"));
}

const zIsoDateTimeString = z.iso.datetime();

function assertIsoDateTimeJsonFields(value: unknown, pathPrefix = ""): void {
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
				throw new Error(
					`Data validation failed: ${path}: date-time fields must be ISO 8601 strings, not numeric timestamps`,
				);
			}
			if (typeof child !== "string") {
				throw new Error(
					`Data validation failed: ${path}: date-time field must be an ISO 8601 string`,
				);
			}
			const parsed = zIsoDateTimeString.safeParse(child);
			if (!parsed.success) {
				throw new Error(
					`Data validation failed: ${path}: expected ISO 8601 date-time string (${formatZodErrors(parsed.error.issues)})`,
				);
			}
		}
		assertIsoDateTimeJsonFields(child, path);
	}
}

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
