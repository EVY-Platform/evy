import type { UI_Row as ServerRow } from "evy-types";
import {
	createRowElement,
	getBaseRowForType,
	type RowComponent,
} from "../rows/rowElementFactory";
import { getRowBindingFields, readBindingFields } from "../rows/rowFields";
import type { Row, RowConfig } from "../types/row";
import { ROW_METADATA_KEYS } from "./rowConstants";

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

// exported for tests
export function normalizeServerRow(row: ServerRow): ServerRow {
	const baseRow = getBaseRowForType(row.type);
	if (!baseRow) {
		return normalizeUnknownServerRow(row);
	}
	return normalizeKnownServerRow(row);
}

function normalizeKnownServerRow(row: ServerRow): ServerRow {
	return {
		...normalizeRowAttributes(row, normalizeServerRow),
		id: row.id,
		type: row.type,
		...readBindingFields(row as Record<string, unknown>, row.type),
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
		...readBindingFields(row as Record<string, unknown>, row.type),
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
		actions: row.config.actions ?? [],
		visible: row.config.visible ?? "true",
	};

	Object.assign(
		serverRow,
		readBindingFields(
			row.config as Record<string, unknown>,
			row.config.type,
		),
	);

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

	return serverRow as unknown as ServerRow;
}

function decodeRow(row: ServerRow): Row {
	const normalized = normalizeServerRow(row);
	return {
		id: normalized.id,
		row: createRowElement(normalized.type, normalized.id),
		config: decodeRowConfig(normalized, row.name),
	};
}

function decodeRowConfig(row: ServerRow, name?: string): RowConfig {
	const config: Record<string, unknown> = {
		type: row.type,
		actions: row.actions,
		visible: row.visible,
		...readBindingFields(row as Record<string, unknown>, row.type),
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

	config.name =
		name ??
		(typeof config.title === "string" && config.title.trim()
			? config.title
			: row.type);

	return config as RowConfig;
}

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
		actions: row.actions ?? [],
		visible: row.visible ?? "true",
	};

	for (const field of getRowBindingFields(row.type)) {
		resetRow[field] = "";
	}

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
	return resetRow as unknown as ServerRow;
}

export function buildRowForNewPageFromBase(
	baseRow: RowComponent,
	newRowId: string,
): Row {
	const tempId = "row-build-temp";
	const seed: Row = {
		id: tempId,
		row: createRowElement(baseRow.config.type, tempId),
		config: baseRow.config,
	};
	const cloned = resetRowAttributesForNewPage(
		structuredClone(rowToServerRow(seed)),
	);
	assignFreshIdsInPlace(cloned, newRowId);
	return decodeRow(cloned);
}
