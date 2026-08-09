import type { DATA_EVY_Row } from "evy-types";
import { readBindingFields } from "../rows/rowFields";
import type { RowConfig } from "../types/row";
import { normalizeStoredRowActions } from "./rowActions";
import { ROW_CHILDREN_FIELD, ROW_SHEET_FIELD } from "./rowConstants";

export function buildRowConfigFromRecord(record: DATA_EVY_Row): RowConfig {
	const data = record.data;

	const sheetRowId =
		typeof data[ROW_SHEET_FIELD] === "string"
			? data[ROW_SHEET_FIELD]
			: undefined;
	const childrenRowIds =
		Array.isArray(data[ROW_CHILDREN_FIELD]) &&
		(data[ROW_CHILDREN_FIELD] as unknown[]).every(
			(id) => typeof id === "string",
		)
			? (data[ROW_CHILDREN_FIELD] as string[])
			: undefined;

	const contentData: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (key !== ROW_CHILDREN_FIELD && key !== ROW_SHEET_FIELD) {
			contentData[key] = value;
		}
	}

	const bindingFields = readBindingFields(contentData, record.type);
	for (const field of Object.keys(bindingFields)) {
		delete contentData[field];
	}

	return {
		...contentData,
		...bindingFields,
		name: record.name,
		type: record.type,
		visible: record.visible,
		title: typeof data.title === "string" ? data.title : "",
		actions: normalizeStoredRowActions(data.actions),
		...(sheetRowId !== undefined ? { sheet_row_id: sheetRowId } : {}),
		...(childrenRowIds !== undefined
			? { children_row_ids: childrenRowIds }
			: {}),
	} as RowConfig;
}
