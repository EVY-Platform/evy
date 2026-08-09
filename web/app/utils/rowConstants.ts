import type { UI_Row as ServerRow } from "evy-types";

// Single source of truth for UI_Row structural metadata field names.
// These are the fixed fields on every row that are not row-type content.
export const ROW_METADATA_KEYS = new Set(["id", "name", "type", "visible"]);

export const ROW_CHILDREN_FIELD = "children_row_ids" as const;
export const ROW_SHEET_FIELD = "sheet_row_id" as const;

export const ROW_DECOMPOSE_SKIP_KEYS = new Set([
	"id",
	"name",
	"type",
	"visible",
	"children",
	"sheet",
]);

export const ROW_ATTRIBUTE_STATIC_NAMES = ["title", "visible"] as const;

// Sentinel rowId used by container placeholder drop targets.
export const containerDropindicatorId = "placeholder";

export function nestedRows(value: unknown): ServerRow[] {
	return Array.isArray(value)
		? value.flatMap((entry) =>
				entry !== null && typeof entry === "object"
					? [entry as ServerRow]
					: [],
			)
		: [];
}
