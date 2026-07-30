/**
 * Immutable flat-map helpers for editing DATA_EVY_* records.
 *
 * All mutations return new maps without modifying the originals.
 * Structural row links live in DATA_EVY_Row.data: child_row_id / children_row_ids.
 * Page structure lives in DATA_EVY_Page: row_ids[], footer_row_id?.
 * Flow structure lives in DATA_EVY_Flow: page_ids[].
 */

import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_RowData,
	UI_RowActions,
} from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import { branchForStorage, parseBranch } from "./actionBranch";
import { collectSubtreeRowIds, type FlowEntityMaps } from "./flowEntities";
import { compactRowActions, normalizeStoredRowActions } from "./rowActions";
import {
	ROW_CHILD_FIELD,
	ROW_CHILDREN_FIELD,
	ROW_SHEET_FIELD,
} from "./rowConstants";
import {
	getChildRowId,
	getChildrenRowIds,
	getSheetRowId,
	pageRootIds,
	walkRows,
} from "./rowTraversal";

export type { FlowEntityMaps };
export { collectSubtreeRowIds };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function now(): string {
	return new Date().toISOString();
}

function touchRow(row: DATA_EVY_Row, updated_at = now()): DATA_EVY_Row {
	return { ...row, updated_at };
}

function touchPage(page: DATA_EVY_Page, updated_at = now()): DATA_EVY_Page {
	return { ...page, updated_at };
}

/** Returns all row ids reachable from a page (row_ids + footer_row_id, recursively). */
function collectPageRowIds(
	page: DATA_EVY_Page,
	rowsById: FlowEntityMaps["rowsById"],
): Set<string> {
	const ids = new Set<string>();
	for (const rowId of page.row_ids) {
		collectSubtreeRowIds(rowId, rowsById, ids);
	}
	if (page.footer_row_id) {
		collectSubtreeRowIds(page.footer_row_id, rowsById, ids);
	}
	return ids;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function findRowContainer(
	rowsById: FlowEntityMaps["rowsById"],
	rootRowIds: string[],
	targetRowId: string,
): { containerRowId: string; type: "child" | "children" | "sheet" } | null {
	return walkRows(
		rowsById,
		rootRowIds,
		(id, _row, childId, sheetId, childrenIds) => {
			if (childId === targetRowId) {
				return { containerRowId: id, type: "child" as const };
			}
			if (sheetId === targetRowId) {
				return { containerRowId: id, type: "sheet" as const };
			}
			if (childrenIds.includes(targetRowId)) {
				return { containerRowId: id, type: "children" as const };
			}
			return null;
		},
	);
}

function findContainerById(
	rowsById: FlowEntityMaps["rowsById"],
	rootRowIds: string[],
	containerId: string,
): { containerRowId: string; type: "child" | "children" | "sheet" } | null {
	return walkRows(rowsById, rootRowIds, (id, row, childId, sheetId) => {
		if (id !== containerId) return null;
		if (childId !== undefined) {
			return { containerRowId: id, type: "child" as const };
		}
		if (sheetId !== undefined) {
			return { containerRowId: id, type: "sheet" as const };
		}
		if (ROW_CHILDREN_FIELD in row.data) {
			return { containerRowId: id, type: "children" as const };
		}
		return null;
	});
}

/**
 * DFS — returns the path [rootId, ..., leafId] from any page-root row to leafId,
 * or null if not found.
 */
export function findRowIdPath(
	rowsById: FlowEntityMaps["rowsById"],
	rootRowIds: string[],
	leafRowId: string,
): string[] | null {
	function dfs(id: string, path: string[]): string[] | null {
		if (id === leafRowId) return [...path, id];
		const row = rowsById[id];
		if (!row) return null;

		const childId = getChildRowId(row);
		if (childId) {
			const result = dfs(childId, [...path, id]);
			if (result) return result;
		}

		const sheetId = getSheetRowId(row);
		if (sheetId) {
			const result = dfs(sheetId, [...path, id]);
			if (result) return result;
		}

		for (const childrenId of getChildrenRowIds(row)) {
			const result = dfs(childrenId, [...path, id]);
			if (result) return result;
		}

		return null;
	}

	for (const rootId of rootRowIds) {
		const result = dfs(rootId, []);
		if (result) return result;
	}
	return null;
}

/**
 * Returns the id of the page that contains rowId (searching all pages of a flow).
 * Walks each page's full row tree.
 */
export function findPageIdContainingRow(
	maps: FlowEntityMaps,
	flowId: string,
	rowId: string,
): string | undefined {
	return findPageContainingRow(maps, flowId, rowId)?.id;
}

// ---------------------------------------------------------------------------
// Internal mutation helpers
// ---------------------------------------------------------------------------

function insertAtIndex(ids: string[], newId: string, index: number): string[] {
	const clamped = Math.max(0, Math.min(index, ids.length));
	const next = [...ids];
	next.splice(clamped, 0, newId);
	return next;
}

function removeId(ids: string[], targetId: string): string[] {
	return ids.filter((id) => id !== targetId);
}

/**
 * Insert newRowId into a container's child/children array, or into page.row_ids.
 * Returns the updated rowsById (if container was updated) and pagesById.
 * Does NOT add the new row record itself — callers must do that separately.
 */
export function insertIntoLocation(
	maps: FlowEntityMaps,
	pageId: string,
	newRowId: string,
	destinationIndex: number,
	destinationContainer?: {
		rowId: string;
		type: "child" | "children" | "sheet";
	},
	ts = now(),
): FlowEntityMaps {
	if (!destinationContainer) {
		const page = maps.pagesById[pageId];
		if (!page) return maps;
		return {
			...maps,
			pagesById: {
				...maps.pagesById,
				[pageId]: touchPage(
					{
						...page,
						row_ids: insertAtIndex(
							page.row_ids,
							newRowId,
							destinationIndex,
						),
					},
					ts,
				),
			},
		};
	}

	const container = maps.rowsById[destinationContainer.rowId];
	if (!container) return maps;

	let updatedData: DATA_EVY_RowData;
	if (destinationContainer.type === "child") {
		updatedData = { ...container.data, [ROW_CHILD_FIELD]: newRowId };
	} else if (destinationContainer.type === "sheet") {
		updatedData = { ...container.data, [ROW_SHEET_FIELD]: newRowId };
	} else {
		const current = getChildrenRowIds(container);
		updatedData = {
			...container.data,
			[ROW_CHILDREN_FIELD]: insertAtIndex(
				current,
				newRowId,
				destinationIndex,
			),
		};
	}

	return {
		...maps,
		rowsById: {
			...maps.rowsById,
			[destinationContainer.rowId]: touchRow(
				{ ...container, data: updatedData },
				ts,
			),
		},
	};
}

/**
 * Remove rowId from wherever it lives in the page (row_ids, footer_row_id,
 * or a container's child_row_id / children_row_ids).
 * Does NOT remove the row record from rowsById — call cleanupOrphanedRows for that.
 */
function removeFromLocation(
	maps: FlowEntityMaps,
	pageId: string,
	rowId: string,
	ts = now(),
): FlowEntityMaps {
	const page = maps.pagesById[pageId];
	if (!page) return maps;

	// Check page-level row_ids
	if (page.row_ids.includes(rowId)) {
		return {
			...maps,
			pagesById: {
				...maps.pagesById,
				[pageId]: touchPage(
					{ ...page, row_ids: removeId(page.row_ids, rowId) },
					ts,
				),
			},
		};
	}

	// Check footer_row_id
	if (page.footer_row_id === rowId) {
		const { footer_row_id: _f, ...pageWithoutFooter } = page;
		return {
			...maps,
			pagesById: {
				...maps.pagesById,
				[pageId]: touchPage(pageWithoutFooter as DATA_EVY_Page, ts),
			},
		};
	}

	// Search through container rows for child_row_id / children_row_ids
	const roots = pageRootIds(page);
	const container = findRowContainer(maps.rowsById, roots, rowId);
	if (!container) return maps;

	const containerRow = maps.rowsById[container.containerRowId];
	if (!containerRow) return maps;

	let updatedData: DATA_EVY_RowData;
	if (container.type === "child") {
		const { [ROW_CHILD_FIELD]: _c, ...dataWithoutChild } =
			containerRow.data;
		updatedData = dataWithoutChild as DATA_EVY_RowData;
	} else if (container.type === "sheet") {
		const { [ROW_SHEET_FIELD]: _s, ...dataWithoutSheet } =
			containerRow.data;
		updatedData = dataWithoutSheet as DATA_EVY_RowData;
	} else {
		updatedData = {
			...containerRow.data,
			[ROW_CHILDREN_FIELD]: removeId(
				getChildrenRowIds(containerRow),
				rowId,
			),
		};
	}

	return {
		...maps,
		rowsById: {
			...maps.rowsById,
			[container.containerRowId]: touchRow(
				{ ...containerRow, data: updatedData },
				ts,
			),
		},
	};
}

/**
 * Remove all row ids from rowsById that are no longer reachable
 * from any page in any flow.
 */
function cleanupOrphanedRows(maps: FlowEntityMaps): FlowEntityMaps {
	const reachable = new Set<string>();
	for (const flow of Object.values(maps.flowsById)) {
		for (const pageId of flow.page_ids) {
			const page = maps.pagesById[pageId];
			if (!page) continue;
			for (const id of collectPageRowIds(page, maps.rowsById)) {
				reachable.add(id);
			}
		}
	}

	const cleaned: FlowEntityMaps["rowsById"] = {};
	for (const [id, row] of Object.entries(maps.rowsById)) {
		if (reachable.has(id)) cleaned[id] = row;
	}

	if (Object.keys(cleaned).length === Object.keys(maps.rowsById).length) {
		return maps;
	}
	return { ...maps, rowsById: cleaned };
}

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Add one or more row records to rowsById.
 */
export function addRowRecords(
	maps: FlowEntityMaps,
	records: DATA_EVY_Row[],
): FlowEntityMaps {
	if (records.length === 0) return maps;
	const next = { ...maps.rowsById };
	for (const record of records) {
		next[record.id] = record;
	}
	return { ...maps, rowsById: next };
}

/**
 * Set a row as the footer of a page.
 */
export function setFooterRow(
	maps: FlowEntityMaps,
	pageId: string,
	rowId: string,
): FlowEntityMaps {
	const page = maps.pagesById[pageId];
	if (!page) return maps;
	const ts = now();
	return {
		...maps,
		pagesById: {
			...maps.pagesById,
			[pageId]: touchPage({ ...page, footer_row_id: rowId }, ts),
		},
	};
}

/**
 * Remove a row from a page and clean up orphaned descendants from rowsById.
 */
export function removeRowFromPage(
	maps: FlowEntityMaps,
	pageId: string,
	rowId: string,
): FlowEntityMaps {
	const afterRemove = removeFromLocation(maps, pageId, rowId);
	return cleanupOrphanedRows(afterRemove);
}

/**
 * Move a row from one location to another (may be same or different page).
 * Handles page-root rows and container children.
 */
export function moveRow(
	maps: FlowEntityMaps,
	rowId: string,
	originPageId: string,
	destPageId: string,
	destIndex: number,
	destContainer?: { rowId: string; type: "child" | "children" | "sheet" },
): FlowEntityMaps {
	const ts = now();
	const afterRemove = removeFromLocation(maps, originPageId, rowId, ts);
	return insertIntoLocation(
		afterRemove,
		destPageId,
		rowId,
		destIndex,
		destContainer,
		ts,
	);
}

/**
 * Move a row to become the footer of destPageId.
 */
export function moveRowToFooter(
	maps: FlowEntityMaps,
	rowId: string,
	originPageId: string,
	destPageId: string,
): FlowEntityMaps {
	const ts = now();
	const afterRemove = removeFromLocation(maps, originPageId, rowId, ts);
	const destPage = afterRemove.pagesById[destPageId];
	if (!destPage) return afterRemove;
	return {
		...afterRemove,
		pagesById: {
			...afterRemove.pagesById,
			[destPageId]: touchPage({ ...destPage, footer_row_id: rowId }, ts),
		},
	};
}

/**
 * Update a single content field in a row's data (e.g. title, label, text, source, destination).
 * "visible" is a top-level field, all others go into data.
 */
export function updateRowField(
	maps: FlowEntityMaps,
	rowId: string,
	field: string,
	value: unknown,
): FlowEntityMaps {
	const row = maps.rowsById[rowId];
	if (!row) return maps;
	const ts = now();

	if (field === "visible") {
		return {
			...maps,
			rowsById: {
				...maps.rowsById,
				[rowId]: touchRow(
					{
						...row,
						visible: typeof value === "string" ? value : "true",
					},
					ts,
				),
			},
		};
	}

	return {
		...maps,
		rowsById: {
			...maps.rowsById,
			[rowId]: touchRow(
				{ ...row, data: { ...row.data, [field]: value } },
				ts,
			),
		},
	};
}

/**
 * Update row actions (stored in data.actions).
 */
export function updateRowActions(
	maps: FlowEntityMaps,
	rowId: string,
	actions: UI_RowActions,
): FlowEntityMaps {
	const row = maps.rowsById[rowId];
	if (!row) return maps;
	const nextActions = compactRowActions(actions);
	return {
		...maps,
		rowsById: {
			...maps.rowsById,
			[rowId]: touchRow(
				{ ...row, data: { ...row.data, actions: nextActions } },
				now(),
			),
		},
	};
}

/**
 * Add a new blank page to a flow.
 */
export function addPage(
	maps: FlowEntityMaps,
	flowId: string,
	page: DATA_EVY_Page,
): FlowEntityMaps {
	const flow = maps.flowsById[flowId];
	if (!flow) return maps;
	const ts = now();
	return {
		...maps,
		flowsById: {
			...maps.flowsById,
			[flowId]: {
				...flow,
				page_ids: [...flow.page_ids, page.id],
				updated_at: ts,
			},
		},
		pagesById: { ...maps.pagesById, [page.id]: page },
	};
}

/**
 * Remove a page from a flow. Also cleans up orphaned rows.
 */
export function removePage(
	maps: FlowEntityMaps,
	flowId: string,
	pageId: string,
): FlowEntityMaps {
	const flow = maps.flowsById[flowId];
	if (!flow) return maps;
	const ts = now();
	const { [pageId]: _removedPage, ...remainingPages } = maps.pagesById;
	const nextMaps: FlowEntityMaps = {
		...maps,
		flowsById: {
			...maps.flowsById,
			[flowId]: {
				...flow,
				page_ids: flow.page_ids.filter((id) => id !== pageId),
				updated_at: ts,
			},
		},
		pagesById: remainingPages,
	};
	return cleanupOrphanedRows(nextMaps);
}

/**
 * Update the title of a page.
 */
export function updatePageTitle(
	maps: FlowEntityMaps,
	pageId: string,
	title: string,
): FlowEntityMaps {
	const page = maps.pagesById[pageId];
	if (!page) return maps;
	return {
		...maps,
		pagesById: {
			...maps.pagesById,
			[pageId]: touchPage({ ...page, title }, now()),
		},
	};
}

/**
 * Applies a record pushed by the server.
 *
 * A push is ignored when the local copy is at least as new, which covers the
 * echo of our own write and, more importantly, avoids overwriting an edit the
 * user has made since the push was generated.
 */
export function applyRemoteRecord(
	maps: FlowEntityMaps,
	resource: string,
	record: { id: string; updated_at?: string; deleted_at?: string },
	operation: "create" | "update" | "delete",
): FlowEntityMaps {
	const mapKey =
		resource === EVY_CORE_RESOURCE_REF.FLOWS
			? "flowsById"
			: resource === EVY_CORE_RESOURCE_REF.PAGES
				? "pagesById"
				: resource === EVY_CORE_RESOURCE_REF.ROWS
					? "rowsById"
					: null;
	if (!mapKey || !record?.id) return maps;

	const collection = maps[mapKey] as Record<string, { updated_at?: string }>;
	const existing = collection[record.id];

	if (operation === "delete" || record.deleted_at) {
		if (!existing) return maps;
		const { [record.id]: _removed, ...rest } = collection;
		return { ...maps, [mapKey]: rest };
	}

	if (existing?.updated_at && record.updated_at) {
		if (existing.updated_at >= record.updated_at) return maps;
	}

	return { ...maps, [mapKey]: { ...collection, [record.id]: record } };
}

/**
 * Set (or clear) the entity a flow declares it submits. Clients validate their
 * create(...,submit) actions against this instead of inferring the target.
 */
export function updateFlowSubmits(
	maps: FlowEntityMaps,
	flowId: string,
	submits: { resource: string } | undefined,
): FlowEntityMaps {
	const flow = maps.flowsById[flowId];
	if (!flow) return maps;
	const { submits: _dropped, ...withoutSubmits } = flow;
	const nextFlow: DATA_EVY_Flow = submits
		? { ...withoutSubmits, submits }
		: withoutSubmits;
	return {
		...maps,
		flowsById: {
			...maps.flowsById,
			[flowId]: { ...nextFlow, updated_at: now() },
		},
	};
}

/**
 * Add a new flow with its pages and rows to the maps.
 */
export function addFlowRecords(
	maps: FlowEntityMaps,
	flow: DATA_EVY_Flow,
	pages: DATA_EVY_Page[],
	rows: DATA_EVY_Row[],
): FlowEntityMaps {
	const nextFlows = { ...maps.flowsById, [flow.id]: flow };
	const nextPages = { ...maps.pagesById };
	for (const page of pages) nextPages[page.id] = page;
	const nextRows = { ...maps.rowsById };
	for (const row of rows) nextRows[row.id] = row;
	return { flowsById: nextFlows, pagesById: nextPages, rowsById: nextRows };
}

// ---------------------------------------------------------------------------
// Helpers for drop-handler container resolution (replaces rowTree page-level helpers)
// ---------------------------------------------------------------------------

/**
 * Find which container in a page holds rowId as a direct child.
 * skipFooterRoot=true prevents reporting the footer root as its own container.
 */
export function findContainerOfRowInPage(
	maps: FlowEntityMaps,
	page: DATA_EVY_Page,
	rowId: string,
): { containerRowId: string; type: "child" | "children" | "sheet" } | null {
	// Search body rows
	const bodyResult = findRowContainer(maps.rowsById, page.row_ids, rowId);
	if (bodyResult) return bodyResult;

	// Search footer subtree — but skip the footer root as its own container
	if (page.footer_row_id) {
		if (page.footer_row_id === rowId) return null;
		const footerResult = findRowContainer(
			maps.rowsById,
			[page.footer_row_id],
			rowId,
		);
		if (footerResult) return footerResult;
	}
	return null;
}

/**
 * Find a container row by its own id in a page.
 */
export function findContainerByIdInPage(
	maps: FlowEntityMaps,
	page: DATA_EVY_Page,
	containerId: string,
): { containerRowId: string; type: "child" | "children" | "sheet" } | null {
	return findContainerById(maps.rowsById, pageRootIds(page), containerId);
}

/**
 * Find the page (within a flow) that contains a given row.
 */
export function findPageContainingRow(
	maps: FlowEntityMaps,
	flowId: string,
	rowId: string,
): DATA_EVY_Page | undefined {
	const flow = maps.flowsById[flowId];
	if (!flow) return undefined;

	for (const pageId of flow.page_ids) {
		const page = maps.pagesById[pageId];
		if (!page) continue;
		const roots = pageRootIds(page);
		if (findRowIdPath(maps.rowsById, roots, rowId)) return page;
	}
	return undefined;
}

/**
 * Returns the number of children in a container's children array.
 * Used by dropHandler to compute insertion index.
 */
export function getContainerChildrenCount(
	maps: FlowEntityMaps,
	containerId: string,
): number {
	const row = maps.rowsById[containerId];
	if (!row) return 0;
	return getChildrenRowIds(row).length;
}

/**
 * Find the index of rowId inside a container's children_row_ids.
 */
export function findChildIndexInContainer(
	maps: FlowEntityMaps,
	containerId: string,
	child_row_id: string,
): number {
	const row = maps.rowsById[containerId];
	if (!row) return -1;
	return getChildrenRowIds(row).indexOf(child_row_id);
}

/**
 * Add a `{show(rowId)}` action to a container row when it gains a sheet child.
 * Updates an existing unconditional show that targeted a replaced sheet row.
 */
export function ensureShowAction(
	maps: FlowEntityMaps,
	containerRowId: string,
	sheet_row_id: string,
	replacedSheetRowId?: string,
): FlowEntityMaps {
	const row = maps.rowsById[containerRowId];
	if (!row) return maps;
	const existingActions =
		normalizeStoredRowActions(row.data.actions).tap ?? [];
	// New actions are written in the structured form; existing ones are only
	// converted when the author saves them.
	const showBranch = branchForStorage(`{show(${sheet_row_id})}`);

	let updatedExisting = false;
	const nextActions = existingActions.map((action) => {
		if (action.condition?.trim()) {
			return action;
		}
		const parsed = parseBranch(action.true);
		if (parsed?.functionName !== "show") {
			return action;
		}
		const targetId = parsed.args[0]?.trim();
		if (replacedSheetRowId && targetId === replacedSheetRowId) {
			updatedExisting = true;
			return { ...action, true: showBranch };
		}
		return action;
	});

	const hasMatchingShow = nextActions.some((action) => {
		if (action.condition?.trim()) return false;
		const parsed = parseBranch(action.true);
		return (
			parsed?.functionName === "show" &&
			parsed.args[0]?.trim() === sheet_row_id
		);
	});

	if (!updatedExisting && !hasMatchingShow) {
		nextActions.push({
			condition: "",
			true: showBranch,
			false: "",
		});
	}

	return updateRowActions(maps, containerRowId, { tap: nextActions });
}
