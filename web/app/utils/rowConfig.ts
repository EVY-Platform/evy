import type { DATA_EVY_Row } from "evy-types";
import type { RowConfig } from "../types/row";
import { ROW_CHILD_FIELD, ROW_CHILDREN_FIELD } from "./rowConstants";

export function buildRowConfigFromRecord(record: DATA_EVY_Row): RowConfig {
	const data = record.data;

	const childRowId =
		typeof data[ROW_CHILD_FIELD] === "string"
			? data[ROW_CHILD_FIELD]
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
		if (key !== ROW_CHILD_FIELD && key !== ROW_CHILDREN_FIELD) {
			contentData[key] = value;
		}
	}

	return {
		...contentData,
		type: record.type,
		visible: record.visible,
		title: typeof data.title === "string" ? data.title : "",
		source: typeof data.source === "string" ? data.source : "",
		destination:
			typeof data.destination === "string" ? data.destination : "",
		actions: Array.isArray(data.actions)
			? (data.actions as RowConfig["actions"])
			: [],
		...(childRowId !== undefined ? { childRowId } : {}),
		...(childrenRowIds !== undefined ? { childrenRowIds } : {}),
	} as RowConfig;
}
