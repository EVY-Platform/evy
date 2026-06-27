import type {
	UI_Flow as ServerFlow,
	UI_Page as ServerPage,
	UI_Row as ServerRow,
} from "evy-types";
import { createElement } from "react";
import { baseRows } from "../rows/baseRows";
import { UnknownRow } from "../rows/EVYRow";
import type { UI_Flow, UI_Page } from "../types/flow";
import type { Row, RowConfig } from "../types/row";
import { ROW_METADATA_KEYS } from "./rowConstants";

type RowComponent = (typeof baseRows)[number];

const BASE_ROW_BY_TYPE = new Map<string, RowComponent>(
	baseRows.map((r) => [r.config.type, r]),
);

function getBaseRowForType(type: string): RowComponent | undefined {
	return BASE_ROW_BY_TYPE.get(type);
}

function rowConfigAttributes(config: RowConfig): Record<string, unknown> {
	const attributes: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(config)) {
		if (!ROW_METADATA_KEYS.has(key) && value !== undefined) {
			attributes[key] = value;
		}
	}
	return attributes;
}

export function mergeRowContentWithPaletteDefaults(
	row: Row,
): Record<string, unknown> {
	const baseRow = getBaseRowForType(row.config.type);
	const attributes = rowConfigAttributes(row.config);
	if (!baseRow) {
		return attributes;
	}
	return {
		...rowConfigAttributes(baseRow.config),
		...attributes,
	};
}

export function normalizeServerRow(row: ServerRow): ServerRow {
	const baseRow = getBaseRowForType(row.type);
	if (!baseRow) {
		return normalizeUnknownServerRow(row);
	}
	return normalizeKnownServerRow(row);
}

export function normalizeServerFlow(flow: ServerFlow): ServerFlow {
	return {
		...flow,
		pages: flow.pages.map((page) => ({
			...page,
			rows: page.rows.map(normalizeServerRow),
			footer: page.footer ? normalizeServerRow(page.footer) : undefined,
		})),
	};
}

function normalizeKnownServerRow(row: ServerRow): ServerRow {
	return {
		...normalizeRowAttributes(row, normalizeServerRow),
		id: row.id,
		type: row.type,
		source: row.source ?? "",
		destination: row.destination ?? "",
		actions: row.actions ?? [],
		visible: row.visible ?? "true",
		title: typeof row.title === "string" ? row.title : "",
	} as ServerRow;
}

function normalizeUnknownServerRow(row: ServerRow): ServerRow {
	return {
		...normalizeRowAttributes(row, normalizeServerRow),
		id: row.id,
		type: row.type,
		source: row.source ?? "",
		destination: row.destination ?? "",
		actions: row.actions ?? [],
		visible: row.visible ?? "true",
		title: typeof row.title === "string" ? row.title : "Unknown row",
	} as ServerRow;
}

function normalizeRowAttributes(
	incoming: ServerRow,
	transformRow: (row: ServerRow) => ServerRow,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(incoming)) {
		if (ROW_METADATA_KEYS.has(key)) {
			continue;
		}
		if (key === "children") {
			out.children = Array.isArray(value)
				? value.map((child) => transformRow(child as ServerRow))
				: [];
			continue;
		}
		if (key === "child") {
			if (value !== undefined && value !== null) {
				out.child = transformRow(value as ServerRow);
			}
			continue;
		}
		if (key === "segments") {
			out.segments = Array.isArray(value)
				? value.filter(
						(segment): segment is string =>
							typeof segment === "string",
					)
				: [];
			continue;
		}
		if (value !== undefined) {
			out[key] = value;
		}
	}
	if (typeof out.title !== "string") {
		out.title = "";
	}
	return out;
}

function rowToServerRow(row: Row): ServerRow {
	const serverRow: Record<string, unknown> = {
		id: row.id,
		type: row.config.type,
		source: row.config.source ?? "",
		destination: row.config.destination ?? "",
		actions: row.config.actions ?? [],
		visible: row.config.visible ?? "true",
	};

	for (const [key, value] of Object.entries(row.config)) {
		if (ROW_METADATA_KEYS.has(key) || value === undefined) {
			continue;
		}
		if (key === "children") {
			serverRow.children = Array.isArray(value)
				? (value as Row[]).map(rowToServerRow)
				: [];
			continue;
		}
		if (key === "child") {
			if (value) {
				serverRow.child = rowToServerRow(value as Row);
			}
			continue;
		}
		serverRow[key] = value;
	}

	if (typeof serverRow.title !== "string") {
		serverRow.title = "";
	}

	return serverRow as ServerRow;
}

function encodeRowToServerRow(row: Row): ServerRow {
	return normalizeServerRow(rowToServerRow(row));
}

export function encodeFlow(flow: UI_Flow): ServerFlow {
	return {
		...flow,
		pages: flow.pages.map((page: UI_Page) => ({
			...page,
			rows: page.rows.map(encodeRowToServerRow),
			footer: page.footer ? encodeRowToServerRow(page.footer) : undefined,
		})),
	};
}

function decodeRow(row: ServerRow): Row {
	const normalized = normalizeServerRow(row);
	const baseRow = getBaseRowForType(normalized.type);
	const config = decodeRowConfig(normalized);
	if (!baseRow) {
		return {
			id: normalized.id,
			row: createElement(UnknownRow, {
				key: normalized.id,
				rowId: normalized.id,
			}),
			config,
		};
	}

	return {
		id: normalized.id,
		row: createElement(baseRow, {
			key: normalized.id,
			rowId: normalized.id,
		}),
		config,
	};
}

function decodeRowConfig(row: ServerRow): RowConfig {
	const config: Record<string, unknown> = {
		type: row.type,
		source: row.source,
		destination: row.destination ?? "",
		actions: row.actions,
		visible: row.visible,
	};

	for (const [key, value] of Object.entries(row)) {
		if (ROW_METADATA_KEYS.has(key) || key === "id" || value === undefined) {
			continue;
		}
		if (key === "children") {
			config.children = Array.isArray(value)
				? value.map((child) => decodeRow(child as ServerRow))
				: [];
			continue;
		}
		if (key === "child") {
			if (value) {
				config.child = decodeRow(value as ServerRow);
			}
			continue;
		}
		config[key] = value;
	}

	if (typeof config.title !== "string") {
		config.title = "";
	}

	return config as RowConfig;
}

export const decodeFlows = (flows: ServerFlow[]): UI_Flow[] => {
	return flows.map((flow) => ({
		...flow,
		pages: flow.pages.map((page: ServerPage) => ({
			...page,
			rows: page.rows.map(decodeRow),
			footer: page.footer ? decodeRow(page.footer) : undefined,
		})),
	}));
};

function assignFreshIdsInPlace(row: ServerRow, rootId: string): void {
	row.id = rootId;
	if (row.child) {
		assignFreshIdsInPlace(row.child, crypto.randomUUID());
	}
	if (row.children) {
		for (const childRow of row.children) {
			assignFreshIdsInPlace(childRow, crypto.randomUUID());
		}
	}
}

function resetRowAttributesForNewPage(row: ServerRow): ServerRow {
	const resetRow: Record<string, unknown> = {
		id: row.id,
		type: row.type,
		source: row.source ?? "",
		destination: row.destination ?? "",
		actions: row.actions ?? [],
		visible: row.visible ?? "true",
	};

	for (const [key, value] of Object.entries(row)) {
		if (ROW_METADATA_KEYS.has(key) || key === "id") {
			continue;
		}
		if (key === "title") {
			resetRow.title = typeof value === "string" ? value : "";
			continue;
		}
		if (key === "children" || key === "segments") {
			resetRow[key] = [];
			continue;
		}
		if (key === "child") {
			if (value !== undefined && value !== null) {
				resetRow.child = value;
			}
			continue;
		}
		resetRow[key] = typeof value === "string" ? "" : value;
	}
	if (typeof resetRow.title !== "string") {
		resetRow.title = "";
	}
	return resetRow as ServerRow;
}

export function buildRowForNewPageFromBase(
	baseRow: RowComponent,
	newRowId: string,
): Row {
	const tempId = "row-build-temp";
	const seed: Row = {
		id: tempId,
		row: createElement(baseRow, { key: tempId, rowId: tempId }),
		config: baseRow.config,
	};
	const cloned = resetRowAttributesForNewPage(
		structuredClone(rowToServerRow(seed)),
	);
	assignFreshIdsInPlace(cloned, newRowId);
	return decodeRow(cloned);
}
