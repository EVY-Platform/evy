/**
 * ISO date-time field validation for data payloads (post-schema).
 */

function isIsoDateTimeFieldName(key: string): boolean {
	return key === "createdAt" || key === "updatedAt" || key === "archivedAt";
}

/** archivedAt is null while the record is active */
function isoDateTimeFieldAllowsNull(key: string): boolean {
	return key === "archivedAt";
}

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
			if (child === null && isoDateTimeFieldAllowsNull(key)) {
				continue;
			}
			if (typeof child === "number" && Number.isFinite(child)) {
				throwDataIsoValidationError(
					path,
					"date-time fields must be ISO 8601 strings, not numeric timestamps",
				);
			}
			if (typeof child !== "string") {
				throwDataIsoValidationError(
					path,
					"date-time field must be an ISO 8601 string",
				);
			}
			if (Number.isNaN(Date.parse(child))) {
				throwDataIsoValidationError(
					path,
					"expected ISO 8601 date-time string",
				);
			}
		}
		assertIsoDateTimeJsonFields(child, path);
	}
}
