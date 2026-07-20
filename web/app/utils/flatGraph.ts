/**
 * Immutable flat-map helpers for editing DATA_EVY_* records.
 *
 * All mutations return new maps without modifying the originals.
 * Structural row links live in DATA_EVY_Row.data: child_row_id / children_row_ids.
 * Page structure lives in DATA_EVY_Page: rowIds[], footerRowId?.
 * Flow structure lives in DATA_EVY_Flow: pageIds[].
 */

import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_RowData,
	UI_RowAction,
} from "evy-types";
import { collectSubtreeRowIds, type FlowEntityMaps } from "./flowEntities";
import { ROW_CHILD_FIELD, ROW_CHILDREN_FIELD } from "./rowConstants";

export type { FlowEntityMaps };
export { collectSubtreeRowIds };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function now(): string {
	return new Date().toISOString();
}

function touchRow(row: DATA_EVY_Row, updatedAt = now()): DATA_EVY_Row {
	return { ...row, updatedAt };
}

function touchPage(page: DATA_EVY_Page, updatedAt = now()): DATA_EVY_Page {
	return { ...page, updatedAt };
}

function getChildRowId(row: DATA_EVY_Row): string | undefined {
	const v = row.data[ROW_CHILD_FIELD];
	return typeof v === "string" ? v : undefined;
}

function getChildrenRowIds(row: DATA_EVY_Row): string[] {
	const v = row.data[ROW_CHILDREN_FIELD];
	return Array.isArray(v)
		? v.filter((x): x is string => typeof x === "string")
		: [];
}

/** Returns all row ids reachable from a page (rowIds + footerRowId, recursively). */
function collectPageRowIds(
	page: DATA_EVY_Page,
	rowsById: FlowEntityMaps["rowsById"],
): Set<string> {
	const ids = new Set<string>();
	for (const rowId of page.rowIds) {
		collectSubtreeRowIds(rowId, rowsById, ids);
	}
	if (page.footerRowId) {
		collectSubtreeRowIds(page.footerRowId, rowsById, ids);
	}
	return ids;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function walkRows<T>(
	rowsById: FlowEntityMaps["rowsById"],
	rootRowIds: string[],
	visit: (
		id: string,
		row: DATA_EVY_Row,
		childId: string | undefined,
		childrenIds: string[],
	) => T | null | undefined,
): T | null {
	const stack = [...rootRowIds];
	while (stack.length > 0) {
		const id = stack.pop();
		if (id === undefined) continue;
		const row = rowsById[id];
		if (!row) continue;

		const childId = getChildRowId(row);
		const childrenIds = getChildrenRowIds(row);
		const result = visit(id, row, childId, childrenIds);
		if (result != null) return result;

		if (childId) stack.push(childId);
		stack.push(...childrenIds);
	}
	return null;
}

function findRowContainer(
	rowsById: FlowEntityMaps["rowsById"],
	rootRowIds: string[],
	targetRowId: string,
): { containerRowId: string; type: "child" | "children" } | null {
	return walkRows(rowsById, rootRowIds, (id, _row, childId, childrenIds) => {
		if (childId === targetRowId) {
			return { containerRowId: id, type: "child" as const };
		}
		if (childrenIds.includes(targetRowId)) {
			return { containerRowId: id, type: "children" as const };
		}
		return null;
	});
}

function findContainerById(
	rowsById: FlowEntityMaps["rowsById"],
	rootRowIds: string[],
	containerId: string,
): { containerRowId: string; type: "child" | "children" } | null {
	return walkRows(rowsById, rootRowIds, (id, row, childId) => {
		if (id !== containerId) return null;
		if (childId !== undefined) {
			return { containerRowId: id, type: "child" as const };
		}
		if (ROW_CHILDREN_FIELD in row.data) {
			return { containerRowId: id, type: "children" as const };
		}
		return null;
	});
}

/**
 * Returns the root ids of all rows in a page (rowIds + footerRowId if present).
 * Used to scope container searches.
 */
export function pageRootIds(page: DATA_EVY_Page): string[] {
	return page.footerRowId
		? [...page.rowIds, page.footerRowId]
		: [...page.rowIds];
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
 * Insert newRowId into a container's child/children array, or into page.rowIds.
 * Returns the updated rowsById (if container was updated) and pagesById.
 * Does NOT add the new row record itself — callers must do that separately.
 */
export function insertIntoLocation(
	maps: FlowEntityMaps,
	pageId: string,
	newRowId: string,
	destinationIndex: number,
	destinationContainer?: { rowId: string; type: "child" | "children" },
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
						rowIds: insertAtIndex(
							page.rowIds,
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
 * Remove rowId from wherever it lives in the page (rowIds, footerRowId,
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

	// Check page-level rowIds
	if (page.rowIds.includes(rowId)) {
		return {
			...maps,
			pagesById: {
				...maps.pagesById,
				[pageId]: touchPage(
					{ ...page, rowIds: removeId(page.rowIds, rowId) },
					ts,
				),
			},
		};
	}

	// Check footerRowId
	if (page.footerRowId === rowId) {
		const { footerRowId: _f, ...pageWithoutFooter } = page;
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
		for (const pageId of flow.pageIds) {
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
			[pageId]: touchPage({ ...page, footerRowId: rowId }, ts),
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
	destContainer?: { rowId: string; type: "child" | "children" },
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
			[destPageId]: touchPage({ ...destPage, footerRowId: rowId }, ts),
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
 * Update the actions array of a row (stored in data.actions).
 */
export function updateRowActions(
	maps: FlowEntityMaps,
	rowId: string,
	actions: UI_RowAction[],
): FlowEntityMaps {
	const row = maps.rowsById[rowId];
	if (!row) return maps;
	return {
		...maps,
		rowsById: {
			...maps.rowsById,
			[rowId]: touchRow(
				{ ...row, data: { ...row.data, actions } },
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
				pageIds: [...flow.pageIds, page.id],
				updatedAt: ts,
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
				pageIds: flow.pageIds.filter((id) => id !== pageId),
				updatedAt: ts,
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
): { containerRowId: string; type: "child" | "children" } | null {
	// Search body rows
	const bodyResult = findRowContainer(maps.rowsById, page.rowIds, rowId);
	if (bodyResult) return bodyResult;

	// Search footer subtree — but skip the footer root as its own container
	if (page.footerRowId) {
		if (page.footerRowId === rowId) return null;
		const footerResult = findRowContainer(
			maps.rowsById,
			[page.footerRowId],
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
): { containerRowId: string; type: "child" | "children" } | null {
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

	for (const pageId of flow.pageIds) {
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
	childRowId: string,
): number {
	const row = maps.rowsById[containerId];
	if (!row) return -1;
	return getChildrenRowIds(row).indexOf(childRowId);
}

/**
 * Add a `{show()}` action to a container row if it doesn't already have one.
 * Used when dropping a row into a child container.
 */
export function ensureShowAction(
	maps: FlowEntityMaps,
	containerRowId: string,
): FlowEntityMaps {
	const row = maps.rowsById[containerRowId];
	if (!row) return maps;
	const existingActions = Array.isArray(row.data.actions)
		? (row.data.actions as UI_RowAction[])
		: [];
	if (existingActions.some((a) => a.true === "{show()}")) return maps;
	const showAction: UI_RowAction = {
		condition: "",
		true: "{show()}",
		false: "",
	};
	return updateRowActions(maps, containerRowId, [
		...existingActions,
		showAction,
	]);
}
