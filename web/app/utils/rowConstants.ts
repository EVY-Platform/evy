// Single source of truth for UI_Row structural metadata field names.
// These are the fixed fields on every row that are not row-type content.
export const ROW_METADATA_KEYS = new Set([
	"id",
	"type",
	"source",
	"destination",
	"actions",
	"visible",
]);
