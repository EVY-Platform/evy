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
				pageIds: pageRows.map((page) => page.id),
				// Test-fixture decomposition only; these records feed the
				// builder directly and are never written back, so this matches
				// the column default rather than carrying real visibility.
				visibility: "public",
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
		visibility: "public",
		createdAt: nowIso,
		updatedAt: nowIso,
	};
}

/**
 * `child` and `children` exist only on some row variants, so on the UI_Row
 * union they resolve through the index signature rather than as rows.
 */
function nestedRow(value: unknown): ServerRow | undefined {
	return value !== null && typeof value === "object"
		? (value as ServerRow)
		: undefined;
}

function nestedRows(value: unknown): ServerRow[] {
	return Array.isArray(value)
		? value.flatMap((entry) => nestedRow(entry) ?? [])
		: [];
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
	const child = nestedRow(row.child);
	if (child) {
		data[ROW_CHILD_FIELD] = decomposeServerRow(child, rowRows, nowIso);
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
		createdAt: nowIso,
		updatedAt: nowIso,
	});
	return row.id;
}
