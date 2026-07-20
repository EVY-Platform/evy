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
			key === "childRowId" ||
			key === "childrenRowIds" ||
			key === "sheetRowId" ||
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

	if (typeof row.config.childRowId === "string") {
		data.child_row_id = row.config.childRowId;
	}

	if (typeof row.config.sheetRowId === "string") {
		data.sheet_row_id = row.config.sheetRowId;
	}

	if (row.config.childrenRowIds?.length) {
		data.children_row_ids = row.config.childrenRowIds;
	}

	const name = row.config.name;

	records.push({
		id: row.id,
		name,
		type: row.config.type,
		visible: row.config.visible ?? "true",
		data: data as DATA_EVY_RowData,
		createdAt: now,
		updatedAt: now,
	});

	return row.id;
}
