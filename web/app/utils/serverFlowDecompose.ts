/**
 * Pure nested-server-flow -> flat-records conversion. Deliberately free
 * of React/rows imports so Node-based tooling (Playwright e2e) can use
 * it without dragging in the app's component graph.
 */
import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_RowData,
	UI_Flow as ServerFlow,
	UI_Page as ServerPage,
	UI_Row as ServerRow,
} from "evy-types";
import {
	nestedRows,
	ROW_CHILDREN_FIELD,
	ROW_DECOMPOSE_SKIP_KEYS,
	ROW_SHEET_FIELD,
} from "./rowConstants";

export type FlatFlowGraph = {
	flowRows: DATA_EVY_Flow[];
	pageRows: DATA_EVY_Page[];
	rowRows: DATA_EVY_Row[];
};

export function decomposeServerFlow(
	flow: ServerFlow,
	nowIso: string,
): FlatFlowGraph {
	const rowRows: DATA_EVY_Row[] = [];
	const pageRows = flow.pages.map((page) =>
		decomposeServerPage(page, rowRows, nowIso),
	);
	return {
		flowRows: [
			{
				id: flow.id,
				name: flow.name,
				page_ids: pageRows.map((page) => page.id),
				// Test-fixture decomposition only; these records feed the builder
				// directly and are never written back, so the value matches what
				// the builder creates rather than carrying real visibility.
				visibility: "public",
				...(flow.submits ? { submits: flow.submits } : {}),
				created_at: nowIso,
				updated_at: nowIso,
			},
		],
		pageRows,
		rowRows,
	};
}

function decomposeServerPage(
	page: ServerPage,
	rowRows: DATA_EVY_Row[],
	nowIso: string,
): DATA_EVY_Page {
	return {
		id: page.id,
		name: page.name,
		title: page.title,
		row_ids: page.rows.map((row) =>
			decomposeServerRow(row, rowRows, nowIso),
		),
		footer_row_id: page.footer
			? decomposeServerRow(page.footer, rowRows, nowIso)
			: undefined,
		visibility: "public",
		created_at: nowIso,
		updated_at: nowIso,
	};
}

function decomposeServerRow(
	row: ServerRow,
	rowRows: DATA_EVY_Row[],
	nowIso: string,
): string {
	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		if (ROW_DECOMPOSE_SKIP_KEYS.has(key)) {
			continue;
		}
		if (value !== undefined) {
			data[key] = value;
		}
	}
	if (row.sheet) {
		data[ROW_SHEET_FIELD] = decomposeServerRow(row.sheet, rowRows, nowIso);
	}
	const children = nestedRows(row.children);
	if (children.length > 0) {
		data[ROW_CHILDREN_FIELD] = children.map((childRow) =>
			decomposeServerRow(childRow, rowRows, nowIso),
		);
	}
	rowRows.push({
		id: row.id,
		name: row.name,
		type: row.type,
		visible: row.visible || "true",
		visibility: "public",
		data: data as DATA_EVY_RowData,
		created_at: nowIso,
		updated_at: nowIso,
	});
	return row.id;
}
