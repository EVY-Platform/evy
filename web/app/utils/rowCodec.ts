import type { DATA_EVY_Row, DATA_EVY_RowData } from "evy-types";
import { createElement } from "react";
import { baseRows } from "../rows/baseRows";
import { UnknownRow } from "../rows/EVYRow";
import type { Row } from "../types/row";
import { buildRowConfigFromRecord } from "./rowConfig";
import { ROW_METADATA_KEYS } from "./rowConstants";

export function storedRowToRow(record: DATA_EVY_Row): Row {
	const config = buildRowConfigFromRecord(record);
	const baseRow = baseRows.find((r) => r.config.type === record.type);
	const row = baseRow
		? createElement(baseRow, { key: record.id, rowId: record.id })
		: createElement(UnknownRow, { key: record.id, rowId: record.id });
	return { id: record.id, row, config };
}

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
			key === "childRowId" ||
			key === "childrenRowIds" ||
			value === undefined
		) {
			continue;
		}
		data[key] = value;
	}

	if (row.config.child) {
		data.child_row_id = decomposeRow(row.config.child, records, now);
	}

	if (row.config.children?.length) {
		data.children_row_ids = row.config.children.map((child) =>
			decomposeRow(child, records, now),
		);
	}

	if (typeof row.config.childRowId === "string") {
		data.child_row_id = row.config.childRowId;
	}

	if (row.config.childrenRowIds?.length) {
		data.children_row_ids = row.config.childrenRowIds;
	}

	const name =
		typeof row.config.title === "string" && row.config.title
			? row.config.title
			: row.config.type;

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
