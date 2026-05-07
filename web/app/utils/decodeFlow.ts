import { createElement } from "react";
import type {
	UI_Flow as ServerFlow,
	UI_Page as ServerPage,
	UI_Row as ServerRow,
	UI_RowContent as ServerRowContent,
} from "evy-types";

import type { Row, RowConfig } from "../types/row";
import type { UI_Flow, UI_Page } from "../types/flow";
import { baseRows } from "../rows/baseRows";
import { UnknownRow } from "../rows/EVYRow";

type RowComponent = (typeof baseRows)[number];

const BASE_ROW_BY_TYPE = new Map<string, RowComponent>(
	baseRows.map((r) => [r.config.type, r]),
);

function getBaseRowForType(type: string): RowComponent | undefined {
	return BASE_ROW_BY_TYPE.get(type);
}

export function mergeRowContentWithPaletteDefaults(
	row: Row,
): Record<string, unknown> {
	const baseRow = getBaseRowForType(row.config.type);
	const content = {
		...(row.config.view.content as Record<string, unknown>),
	};
	if (!baseRow) {
		return content;
	}
	return {
		...(baseRow.config.view.content as Record<string, unknown>),
		...content,
	};
}

export function normalizeServerRow(row: ServerRow): ServerRow {
	const baseRow = getBaseRowForType(row.type);
	if (!baseRow) {
		return normalizeUnknownServerRow(row);
	}
	const def = baseRow.config;
	const mergedContent = normalizeRowContentAgainstDefaults(
		row.view.content,
		def.view.content,
	);
	const mergedView: ServerRow["view"] = {
		content: mergedContent,
	};
	if (row.view.max_lines !== undefined || def.view.max_lines !== undefined) {
		mergedView.max_lines = row.view.max_lines ?? def.view.max_lines ?? "";
	}
	return {
		id: row.id,
		type: row.type,
		source: row.source ?? def.source ?? "",
		destination: row.destination ?? def.destination ?? "",
		actions: row.actions ?? def.actions ?? [],
		view: mergedView,
	};
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

function normalizeUnknownServerRow(row: ServerRow): ServerRow {
	const title =
		typeof row.view.content.title === "string"
			? row.view.content.title
			: "Unknown row";
	return {
		id: row.id,
		type: row.type,
		source: row.source ?? "",
		destination: row.destination ?? "",
		actions: row.actions ?? [],
		view: {
			...(row.view.max_lines !== undefined
				? { max_lines: row.view.max_lines }
				: {}),
			content: {
				...row.view.content,
				title,
			} as ServerRowContent,
		},
	};
}

function mergeRowContent(
	incoming: Record<string, unknown>,
	defaults: Record<string, unknown>,
	transformRow: (row: ServerRow | Row) => ServerRow,
	transformDefaultRow: (row: Row) => ServerRow,
): ServerRowContent {
	const allKeys = new Set([...Object.keys(defaults), ...Object.keys(incoming)]);
	const out: Record<string, unknown> = {};

	for (const key of allKeys) {
		if (key === "children") {
			const defaultChildren = Array.isArray(defaults.children)
				? defaults.children
				: [];
			const rawChildren: unknown =
				"children" in incoming
					? Array.isArray(incoming.children)
						? incoming.children
						: []
					: defaultChildren;
			out.children = (rawChildren as Row[]).map((child) =>
				transformRow(child as unknown as ServerRow),
			);
			continue;
		}
		if (key === "child") {
			if (
				"child" in incoming &&
				incoming.child !== undefined &&
				incoming.child !== null
			) {
				out.child = transformRow(incoming.child as ServerRow);
			} else if (defaults.child !== undefined && defaults.child !== null) {
				out.child = transformDefaultRow(defaults.child as Row);
			}
			continue;
		}
		if (key === "segments") {
			const defaultSegments = Array.isArray(defaults.segments)
				? defaults.segments
				: [];
			const rawSegments: unknown =
				"segments" in incoming
					? Array.isArray(incoming.segments) &&
						incoming.segments.every((x): x is string => typeof x === "string")
						? incoming.segments
						: []
					: defaultSegments;
			out.segments = rawSegments;
			continue;
		}

		const defaultValue = defaults[key];
		const incomingValue = incoming[key];
		if (typeof defaultValue === "string" || typeof incomingValue === "string") {
			out[key] =
				typeof incomingValue === "string"
					? incomingValue
					: typeof defaultValue === "string"
						? defaultValue
						: "";
		} else if (incomingValue !== undefined) {
			out[key] = incomingValue;
		} else if (defaultValue !== undefined) {
			out[key] = defaultValue;
		}
	}

	return out as unknown as ServerRowContent;
}

function normalizeRowContentAgainstDefaults(
	incoming: ServerRowContent,
	defaults: RowConfig["view"]["content"],
): ServerRowContent {
	return mergeRowContent(
		incoming as unknown as Record<string, unknown>,
		defaults as unknown as Record<string, unknown>,
		(child) => normalizeServerRow(child as ServerRow),
		(defChild) => normalizeServerRow(rowToServerRow(defChild)),
	);
}

/** Map builder Row → wire ServerRow shape (recursive child/children); does not run `normalizeServerRow`. */
function rowToServerRow(row: Row): ServerRow {
	const { view, ...rowRoot } = row.config;
	const content = view.content as unknown as Record<string, unknown>;
	const serverContent: Record<string, unknown> = {};
	for (const key of Object.keys(content)) {
		if (key === "children") {
			const ch = content.children;
			serverContent.children = Array.isArray(ch)
				? (ch as Row[]).map(rowToServerRow)
				: [];
		} else if (key === "child") {
			if (content.child) {
				serverContent.child = rowToServerRow(content.child as Row);
			}
		} else {
			serverContent[key] = content[key];
		}
	}
	return {
		id: row.id,
		...rowRoot,
		view: {
			...view,
			content: serverContent as unknown as ServerRowContent,
		},
	} as ServerRow;
}

function encodeMergeRowContent(
	incomingRowContent: Record<string, unknown>,
	defaults: RowConfig["view"]["content"],
): ServerRowContent {
	return mergeRowContent(
		incomingRowContent,
		defaults as unknown as Record<string, unknown>,
		(child) => encodeRowToServerRow(child as Row),
		(defChild) => encodeRowToServerRow(defChild),
	);
}

function encodeRowToServerRow(row: Row): ServerRow {
	const baseRow = getBaseRowForType(row.config.type);
	if (!baseRow) {
		return normalizeUnknownServerRow(rowToServerRow(row));
	}
	const def = baseRow.config;
	const mergedContent = encodeMergeRowContent(
		row.config.view.content as unknown as Record<string, unknown>,
		def.view.content,
	);
	const mergedView: ServerRow["view"] = {
		content: mergedContent,
	};
	if (
		row.config.view.max_lines !== undefined ||
		def.view.max_lines !== undefined
	) {
		mergedView.max_lines =
			row.config.view.max_lines ?? def.view.max_lines ?? "";
	}
	return {
		id: row.id,
		type: row.config.type,
		source: row.config.source ?? def.source ?? "",
		destination: row.config.destination ?? def.destination ?? "",
		actions: row.config.actions ?? def.actions ?? [],
		view: mergedView,
	};
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
	if (!baseRow) {
		return {
			id: normalized.id,
			row: createElement(UnknownRow, {
				key: normalized.id,
				rowId: normalized.id,
			}),
			config: UnknownRow.config,
		};
	}
	const vc = normalized.view.content;
	const decodedContent = {
		...vc,
		...(Array.isArray(vc.children)
			? {
					children: vc.children.map((child: ServerRow) => decodeRow(child)),
				}
			: {}),
		...(vc.child ? { child: decodeRow(vc.child) } : {}),
	} as unknown as Row["config"]["view"]["content"];

	return {
		id: normalized.id,
		row: createElement(baseRow, { key: normalized.id, rowId: normalized.id }),
		config: {
			type: normalized.type,
			source: normalized.source,
			destination: normalized.destination,
			actions: normalized.actions,
			view: {
				max_lines: normalized.view.max_lines,
				content: decodedContent,
			},
		},
	};
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
	const { child, children } = row.view.content;
	if (child) {
		assignFreshIdsInPlace(child, crypto.randomUUID());
	}
	if (children) {
		for (const c of children) {
			assignFreshIdsInPlace(c, crypto.randomUUID());
		}
	}
}

/** Clone a palette base row for `ADD_ROW`: encode to ServerRow, deep-clone, assign fresh ids, decode. */
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
	const cloned = structuredClone(encodeRowToServerRow(seed));
	assignFreshIdsInPlace(cloned, newRowId);
	return decodeRow(cloned);
}
