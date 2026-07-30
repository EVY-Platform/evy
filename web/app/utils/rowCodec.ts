import type { DATA_EVY_Row, DATA_EVY_RowData } from "evy-types";
import type { Row } from "../types/row";
import { ROW_METADATA_KEYS } from "./rowConstants";

export function rowToFlatRecords(row: Row, nowIso?: string): DATA_EVY_Row[] {
	const now = nowIso ?? new Date().toISOString();
	const records: DATA_EVY_Row[] = [];
	decomposeRow(row, records, now);
	return records;
}

function decomposeRow(row: Row, records: DATA_EVY_Row[], now: string): string {
	const data: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(row.config)) {
		if (
			ROW_METADATA_KEYS.has(key) ||
			key === "child" ||
			key === "children" ||
			key === "sheet" ||
			key === "child_row_id" ||
			key === "children_row_ids" ||
			key === "sheet_row_id" ||
			value === undefined
		) {
			continue;
		}
		data[key] = value;
	}

	if (row.config.child) {
		data.child_row_id = decomposeRow(row.config.child, records, now);
	}

	if (row.config.sheet) {
		data.sheet_row_id = decomposeRow(row.config.sheet, records, now);
	}

	if (row.config.children?.length) {
		data.children_row_ids = row.config.children.map((child) =>
			decomposeRow(child, records, now),
		);
	}

	if (typeof row.config.child_row_id === "string") {
		data.child_row_id = row.config.child_row_id;
	}

	if (typeof row.config.sheet_row_id === "string") {
		data.sheet_row_id = row.config.sheet_row_id;
	}

	if (row.config.children_row_ids?.length) {
		data.children_row_ids = row.config.children_row_ids;
	}

	// Required on the stored row, so it cannot be left undefined. Same fallback
	// decodeFlow applies when reading a row without one.
	const name =
		row.config.name ?? (row.config.title?.trim() || row.config.type);

	records.push({
		id: row.id,
		name,
		type: row.config.type,
		visible: row.config.visible ?? "true",
		// The builder's row model has no visibility of its own, and the API applies
		// no default, so the value builder rows are created with is stated here.
		visibility: "public",
		data: data as DATA_EVY_RowData,
		created_at: now,
		updated_at: now,
	});

	return row.id;
}
