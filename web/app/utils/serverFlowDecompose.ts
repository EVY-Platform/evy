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
	ROW_CHILD_FIELD,
	ROW_CHILDREN_FIELD,
	ROW_DECOMPOSE_SKIP_KEYS,
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
				pageIds: pageRows.map((page) => page.id),
				createdAt: nowIso,
				updatedAt: nowIso,
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
		rowIds: page.rows.map((row) =>
			decomposeServerRow(row, rowRows, nowIso),
		),
		footerRowId: page.footer
			? decomposeServerRow(page.footer, rowRows, nowIso)
			: undefined,
		createdAt: nowIso,
		updatedAt: nowIso,
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
	if (row.child) {
		data[ROW_CHILD_FIELD] = decomposeServerRow(row.child, rowRows, nowIso);
	}
	if (Array.isArray(row.children) && row.children.length > 0) {
		data[ROW_CHILDREN_FIELD] = row.children.map((child) =>
			decomposeServerRow(child, rowRows, nowIso),
		);
	}
	rowRows.push({
		id: row.id,
		name: row.name,
		type: row.type,
		visible: row.visible || "true",
		data: data as DATA_EVY_RowData,
		createdAt: nowIso,
		updatedAt: nowIso,
	});
	return row.id;
}
