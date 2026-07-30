import type { UI_Row as ServerRow } from "evy-types";
import {
	createRowElement,
	getBaseRowForType,
	type RowComponent,
} from "../rows/rowElementFactory";
import { getRowBindingFields, readBindingFields } from "../rows/rowFields";
import { getRowTriggers } from "../rows/rowTriggers";
import type { Row, RowConfig } from "../types/row";
import {
	compactRowActions,
	normalizeStoredRowActions,
	rowAction,
} from "./rowActions";
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
	return normalizeServerRowWithDefaultTitle(
		row,
		baseRow ? "" : "Unknown row",
	);
}

function normalizeServerRowWithDefaultTitle(
	row: ServerRow,
	defaultTitle: string,
): ServerRow {
	return {
		...normalizeRowAttributes(row, normalizeServerRow),
		id: row.id,
		type: row.type,
		...readBindingFields(row as Record<string, unknown>, row.type),
		actions: normalizeStoredRowActions(row.actions),
		visible: row.visible ?? "true",
		title: typeof row.title === "string" ? row.title : defaultTitle,
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
		if (key === "sheet") {
			if (value !== undefined && value !== null) {
				out.sheet = transformRow(value as ServerRow);
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
		actions: compactRowActions(
			normalizeStoredRowActions(row.config.actions),
		),
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
		if (key === "sheet") {
			if (value) {
				serverRow.sheet = rowToServerRow(value as Row);
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
		actions: normalizeStoredRowActions(row.actions),
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
		if (key === "sheet") {
			if (value) {
				config.sheet = decodeRow(value as ServerRow);
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

/**
 * `child` and `children` exist only on some row variants, so on the UI_Row
 * union they resolve through the index signature rather than as rows. Read
 * them through a shape check, the same way row payload fields are read.
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

function assignFreshIdsInPlace(row: ServerRow, rootId: string): void {
	row.id = rootId;
	const child = nestedRow(row.child);
	if (child) {
		assignFreshIdsInPlace(child, crypto.randomUUID());
	}
	if (row.sheet) {
		assignFreshIdsInPlace(row.sheet, crypto.randomUUID());
	}
	for (const childRow of nestedRows(row.children)) {
		assignFreshIdsInPlace(childRow, crypto.randomUUID());
	}
}

function resetRowAttributesForNewPage(row: ServerRow): ServerRow {
	const resetRow: Record<string, unknown> = {
		id: row.id,
		type: row.type,
		actions: normalizeStoredRowActions(row.actions),
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
		if (key === "sheet") {
			if (value !== undefined && value !== null) {
				resetRow.sheet = value;
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
	const row = decodeRow(cloned);
	let actions = normalizeStoredRowActions(row.config.actions);

	if (row.config.type === "text_expand") {
		actions = {
			...actions,
			tap: [rowAction({ fn: "expand_text", row_id: newRowId })],
		};
	}

	let nextActions = { ...actions };
	for (const triggerSpec of getRowTriggers(row.config.type)) {
		const trigger = triggerSpec.trigger;
		const existing = nextActions[trigger];
		if (existing && existing.length > 0) {
			continue;
		}
		if (!triggerSpec.required) {
			continue;
		}
		nextActions = {
			...nextActions,
			[trigger]: [rowAction({ fn: "show", row_id: newRowId })],
		};
	}
	actions = nextActions;

	return {
		...row,
		config: {
			...row.config,
			actions: compactRowActions(actions),
		},
	};
}
