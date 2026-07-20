// Single source of truth for UI_Row structural metadata field names.
// These are the fixed fields on every row that are not row-type content.
export const ROW_METADATA_KEYS = new Set([
	"id",
	"name",
	"type",
	"actions",
	"visible",
]);

export const ROW_CHILD_FIELD = "child_row_id" as const;
export const ROW_CHILDREN_FIELD = "children_row_ids" as const;

export const ROW_DECOMPOSE_SKIP_KEYS = new Set([
	"id",
	"name",
	"type",
	"visible",
	"child",
	"children",
]);

export const ROW_ATTRIBUTE_STATIC_NAMES = ["title", "visible"] as const;

// Sentinel rowId used by container placeholder drop targets.
export const containerDropindicatorId = "placeholder";
