import type { DATA_EVY_Row } from "evy-types";
import type { RowConfig } from "../types/row";

export function buildRowConfigFromRecord(record: DATA_EVY_Row): RowConfig {
	const data = record.data;

	const childRowId =
		typeof data.child_row_id === "string" ? data.child_row_id : undefined;
	const childrenRowIds =
		Array.isArray(data.children_row_ids) &&
		(data.children_row_ids as unknown[]).every(
			(id) => typeof id === "string",
		)
			? (data.children_row_ids as string[])
			: undefined;

	const contentData: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (key !== "child_row_id" && key !== "children_row_ids") {
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
