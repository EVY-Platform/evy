import type { DATA_EVY_Row } from "evy-types";
import { readBindingFields } from "../rows/rowFields";
import type { RowConfig } from "../types/row";
import {
	ROW_CHILD_FIELD,
	ROW_CHILDREN_FIELD,
	ROW_SHEET_FIELD,
} from "./rowConstants";

export function buildRowConfigFromRecord(record: DATA_EVY_Row): RowConfig {
	const data = record.data;

	const childRowId =
		typeof data[ROW_CHILD_FIELD] === "string"
			? data[ROW_CHILD_FIELD]
			: undefined;
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
		if (
			key !== ROW_CHILD_FIELD &&
			key !== ROW_CHILDREN_FIELD &&
			key !== ROW_SHEET_FIELD
		) {
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
		actions: Array.isArray(data.actions)
			? (data.actions as RowConfig["actions"])
			: [],
		...(childRowId !== undefined ? { childRowId } : {}),
		...(sheetRowId !== undefined ? { sheetRowId } : {}),
		...(childrenRowIds !== undefined ? { childrenRowIds } : {}),
	} as RowConfig;
}
