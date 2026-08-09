/**
 * Low-level traversal over the flat row graph.
 *
 * Structural row links live in DATA_EVY_Row.data: sheet_row_id /
 * children_row_ids. This module has no dependencies on the higher-level
 * editing helpers so it can be imported from anywhere without creating cycles.
 */

import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { ROW_CHILDREN_FIELD, ROW_SHEET_FIELD } from "./rowConstants";

export function getSheetRowId(row: DATA_EVY_Row): string | undefined {
	const v = row.data[ROW_SHEET_FIELD];
	return typeof v === "string" ? v : undefined;
}

export function getChildrenRowIds(row: DATA_EVY_Row): string[] {
	const v = row.data[ROW_CHILDREN_FIELD];
	return Array.isArray(v)
		? v.filter((x): x is string => typeof x === "string")
		: [];
}

/**
 * Returns the root ids of all rows in a page (row_ids + footer_row_id if present).
 * Used to scope container searches.
 */
export function pageRootIds(page: DATA_EVY_Page): string[] {
	return page.footer_row_id
		? [...page.row_ids, page.footer_row_id]
		: [...page.row_ids];
}

/**
 * DFS over rows reachable from rootRowIds. Returns the first non-null value
 * produced by visit (early exit), or null after visiting every row.
 */
export function walkRows<T>(
	rowsById: Record<string, DATA_EVY_Row>,
	rootRowIds: string[],
	visit: (
		id: string,
		row: DATA_EVY_Row,
		sheetId: string | undefined,
		childrenIds: string[],
	) => T | null | undefined,
): T | null {
	const stack = [...rootRowIds];
	const visited = new Set<string>();
	while (stack.length > 0) {
		const id = stack.pop();
		if (id === undefined || visited.has(id)) continue;
		visited.add(id);
		const row = rowsById[id];
		if (!row) continue;

		const sheetId = getSheetRowId(row);
		const childrenIds = getChildrenRowIds(row);
		const result = visit(id, row, sheetId, childrenIds);
		if (result != null) return result;

		if (sheetId) stack.push(sheetId);
		stack.push(...childrenIds);
	}
	return null;
}

/** Canonical "where is this row" label used by pickers and action summaries. */
export function rowLocationLabel(
	flow: DATA_EVY_Flow,
	page: DATA_EVY_Page,
	row: DATA_EVY_Row,
): string {
	return `${flow.name} / ${page.name} / ${row.name}`;
}

/**
 * Visits every row reachable from every page of a single flow.
 */
export function forEachRowInFlow(
	flow: DATA_EVY_Flow,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	visit: (id: string, row: DATA_EVY_Row) => void,
): void {
	for (const pageId of flow.page_ids) {
		const page = pagesById[pageId];
		if (!page) continue;
		walkRows(rowsById, pageRootIds(page), (id, row) => {
			visit(id, row);
			return null;
		});
	}
}

/**
 * Visits every row reachable from every page of every flow. Returns the first
 * non-null value produced by visit (early exit), or null after visiting all.
 */
export function forEachRowInFlows<T>(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	visit: (
		flow: DATA_EVY_Flow,
		page: DATA_EVY_Page,
		row: DATA_EVY_Row,
		rowId: string,
	) => T | null | undefined,
): T | null {
	for (const flow of Object.values(flowsById)) {
		for (const pageId of flow.page_ids) {
			const page = pagesById[pageId];
			if (!page) continue;
			const result = walkRows(rowsById, pageRootIds(page), (id, row) =>
				visit(flow, page, row, id),
			);
			if (result != null) return result;
		}
	}
	return null;
}
