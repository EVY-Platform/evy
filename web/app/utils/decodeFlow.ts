import type {
	UI_Flow as ServerFlow,
	UI_Page as ServerPage,
	UI_Row as ServerRow,
	UI_RowContent as ServerRowContent,
} from "evy-types";
import { createElement } from "react";
import { baseRows } from "../rows/baseRows";
import { UnknownRow } from "../rows/EVYRow";
import type { UI_Flow, UI_Page } from "../types/flow";
import type { Row } from "../types/row";

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
	const view: ServerRow["view"] = {
		content: normalizeServerRowContent(row.view.content),
	};
	if (row.view.max_lines !== undefined) {
		view.max_lines = row.view.max_lines;
	}
	return {
		id: row.id,
		type: row.type,
		source: row.source ?? "",
		destination: row.destination ?? "",
		actions: row.actions ?? [],
		visible: row.visible ?? "true",
		view,
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
		visible: row.visible ?? "true",
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

function normalizeServerRowContent(
	incoming: ServerRowContent,
): ServerRowContent {
	return transformRowContent(
		incoming as unknown as Record<string, unknown>,
		normalizeServerRow,
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

function encodeRowContent(incoming: Record<string, unknown>): ServerRowContent {
	return transformRowContent(incoming, (row) =>
		encodeRowToServerRow(row as unknown as Row),
	);
}

function transformRowContent(
	incoming: Record<string, unknown>,
	transformRow: (row: ServerRow) => ServerRow,
): ServerRowContent {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(incoming)) {
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
		out[key] = value;
	}
	if (typeof out.title !== "string") {
		out.title = "";
	}
	return out as unknown as ServerRowContent;
}

function encodeRowToServerRow(row: Row): ServerRow {
	const baseRow = getBaseRowForType(row.config.type);
	if (!baseRow) {
		return normalizeUnknownServerRow(rowToServerRow(row));
	}
	const view: ServerRow["view"] = {
		content: encodeRowContent(
			row.config.view.content as unknown as Record<string, unknown>,
		),
	};
	if (row.config.view.max_lines !== undefined) {
		view.max_lines = row.config.view.max_lines;
	}
	return {
		id: row.id,
		type: row.config.type,
		source: row.config.source ?? "",
		destination: row.config.destination ?? "",
		actions: row.config.actions ?? [],
		visible: row.config.visible ?? "true",
		view,
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
			config: {
				type: normalized.type,
				source: normalized.source,
				destination: normalized.destination,
				actions: normalized.actions,
				visible: normalized.visible,
				view: normalized.view as Row["config"]["view"],
			},
		};
	}
	const vc = normalized.view.content;
	const decodedContent = {
		...vc,
		...(Array.isArray(vc.children)
			? {
					children: vc.children.map((child: ServerRow) =>
						decodeRow(child),
					),
				}
			: {}),
		...(vc.child ? { child: decodeRow(vc.child) } : {}),
	} as unknown as Row["config"]["view"]["content"];

	return {
		id: normalized.id,
		row: createElement(baseRow, {
			key: normalized.id,
			rowId: normalized.id,
		}),
		config: {
			type: normalized.type,
			source: normalized.source,
			destination: normalized.destination,
			actions: normalized.actions,
			visible: normalized.visible,
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

function resetContentToTestTitleOnly(
	content: ServerRowContent,
): ServerRowContent {
	const resetContent: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(
		content as unknown as Record<string, unknown>,
	)) {
		if (key === "title") {
			resetContent.title = typeof value === "string" ? value : "";
			continue;
		}
		if (key === "children" || key === "segments") {
			resetContent[key] = [];
			continue;
		}
		if (key === "child") {
			if (value !== undefined && value !== null) {
				resetContent.child = value;
			}
			continue;
		}
		resetContent[key] = typeof value === "string" ? "" : value;
	}
	if (typeof resetContent.title !== "string") {
		resetContent.title = "";
	}
	return resetContent as unknown as ServerRowContent;
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
	const cloned = structuredClone(rowToServerRow(seed));
	cloned.view.content = resetContentToTestTitleOnly(cloned.view.content);
	assignFreshIdsInPlace(cloned, newRowId);
	return decodeRow(cloned);
}
