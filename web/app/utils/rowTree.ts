import invariant from "tiny-invariant";

import type { UI_Page } from "../types/flow";
import type { Row, ContainerType } from "../types/row";

type ResolvedDropDestinationPage = {
	page: UI_Page;
	resolvedPageId: string;
};

export function resolveDestinationPageFromRawPageId(
	rawDestinationPageId: string,
	pages: UI_Page[],
): ResolvedDropDestinationPage {
	const destinationPage = pages.find(
		(page) => page.id === rawDestinationPageId,
	);
	invariant(
		destinationPage,
		"resolveDestinationPageFromRawPageId: destinationPage is not defined",
	);
	return {
		page: destinationPage,
		resolvedPageId: rawDestinationPageId,
	};
}

export function findRowInPages(
	rowId: string,
	pages: { rows: Row[]; footer?: Row }[],
): Row | undefined {
	for (const page of pages) {
		const found = findRowInSinglePage(page, rowId);
		if (found) return found;
	}
	return undefined;
}

export function findRowInSinglePage(
	page: { rows: Row[]; footer?: Row },
	rowId: string,
): Row | undefined {
	for (const row of page.rows) {
		const found = findRowInSubtree(row, rowId);
		if (found) return found;
	}
	if (page.footer) {
		return findRowInSubtree(page.footer, rowId);
	}
	return undefined;
}

export function findRowIdPathFromPageRoot(
	page: UI_Page,
	leafRowId: string,
): string[] | null {
	for (const top of page.rows) {
		const path = findRowIdPathFromAncestorRow(top, leafRowId);
		if (path) return path;
	}
	if (page.footer) {
		return findRowIdPathFromAncestorRow(page.footer, leafRowId);
	}
	return null;
}

function findRowIdPathFromAncestorRow(
	root: Row,
	leafRowId: string,
): string[] | null {
	if (root.id === leafRowId) return [root.id];

	const child = root.config.view.content.child;
	if (child) {
		const sub = findRowIdPathFromAncestorRow(child, leafRowId);
		if (sub) return [root.id, ...sub];
	}

	for (const nested of root.config.view.content.children ?? []) {
		const sub = findRowIdPathFromAncestorRow(nested, leafRowId);
		if (sub) return [root.id, ...sub];
	}

	return null;
}

function findRowInSubtree(row: Row, rowId: string): Row | undefined {
	if (row.id === rowId) return row;

	const child = row.config.view.content.child;
	if (child) {
		const foundChild = findRowInSubtree(child, rowId);
		if (foundChild) return foundChild;
	}

	for (const childRow of row.config.view.content.children ?? []) {
		const foundChild = findRowInSubtree(childRow, rowId);
		if (foundChild) return foundChild;
	}

	return undefined;
}

export function getRowsRecursive(row: Row): Row[] {
	return [
		row,
		...(row.config.view.content.child
			? getRowsRecursive(row.config.view.content.child)
			: []),
		...(row.config.view.content.children
			? row.config.view.content.children.flatMap(getRowsRecursive)
			: []),
	];
}

type ContainerSearchFn = (
	container: Row,
) => { rowId: string; type: ContainerType } | null;

// -- DEDUPLICATED CONTAINER SEARCH --

/**
 * Searches through rows to find which container holds a row with the given ID.
 * Returns the container row and whether it's a "child" (singular) or "children" (array) container.
 */
export function findContainerOfRow(
	rowId: string,
	rows: Row[],
): { container: Row; type: ContainerType } | null {
	return findContainerByPredicate(rows, (container) => {
		if (container.config.view.content.child?.id === rowId) {
			return { rowId: container.id, type: "child" as ContainerType };
		}
		if (container.config.view.content.children?.some((r) => r.id === rowId)) {
			return { rowId: container.id, type: "children" as ContainerType };
		}
		return null;
	});
}

/**
 * Searches through rows to find a container row by its own ID.
 * Returns the container row and its container type.
 */
export function findContainerById(
	rowId: string,
	rows: Row[],
): { container: Row; type: ContainerType } | null {
	return findContainerByPredicate(rows, (container) => {
		if ("child" in container.config.view.content && container.id === rowId) {
			return { rowId: container.id, type: "child" as ContainerType };
		}
		if ("children" in container.config.view.content && container.id === rowId) {
			return { rowId: container.id, type: "children" as ContainerType };
		}
		return null;
	});
}

/**
 * Generic recursive search for a container matching a predicate.
 * Walks through rows and their children/child subtrees.
 */
function findContainerByPredicate(
	rows: Row[],
	predicate: ContainerSearchFn,
): { container: Row; type: ContainerType } | null {
	for (const row of rows) {
		const match = predicate(row);
		if (match) return { container: row, type: match.type };

		if (row.config.view.content.child) {
			const childResult = findContainerByPredicate(
				[row.config.view.content.child],
				predicate,
			);
			if (childResult) return childResult;
		}

		if (row.config.view.content.children) {
			const nestedResult = findContainerByPredicate(
				row.config.view.content.children,
				predicate,
			);
			if (nestedResult) return nestedResult;
		}
	}
	return null;
}

function withContentUpdate(
	row: Row,
	contentPatch: Partial<Row["config"]["view"]["content"]>,
): Row {
	return {
		...row,
		config: {
			...row.config,
			view: {
				...row.config.view,
				content: { ...row.config.view.content, ...contentPatch },
			},
		},
	};
}

function removeRowInSubtree(row: Row, targetRowId: string): Row {
	let nextRow = row;

	if (row.config.view.content.children) {
		const filteredChildren = row.config.view.content.children.filter(
			(child) => child.id !== targetRowId,
		);
		const updatedChildren = filteredChildren.map((child) =>
			removeRowInSubtree(child, targetRowId),
		);
		const childUpdated =
			filteredChildren.length !== row.config.view.content.children.length ||
			updatedChildren.some((child, index) => child !== filteredChildren[index]);
		if (childUpdated) {
			nextRow = withContentUpdate(row, { children: updatedChildren });
		}
	}

	if (nextRow.config.view.content.child?.id === targetRowId) {
		return withContentUpdate(nextRow, { child: undefined });
	}

	if (nextRow.config.view.content.child) {
		const updatedChild = removeRowInSubtree(
			nextRow.config.view.content.child,
			targetRowId,
		);
		if (updatedChild !== nextRow.config.view.content.child) {
			return withContentUpdate(nextRow, { child: updatedChild });
		}
	}

	return nextRow;
}

export function removeRowFromTree(rows: Row[], targetRowId: string): Row[] {
	return rows
		.filter((r) => r.id !== targetRowId)
		.map((r) => removeRowInSubtree(r, targetRowId));
}

function insertRowAtIndex(
	rows: Row[],
	row: Row,
	destinationIndex: number,
): Row[] {
	const normalizedIndex = Math.max(0, Math.min(destinationIndex, rows.length));
	const updatedRows = [...rows];
	updatedRows.splice(normalizedIndex, 0, row);
	return updatedRows;
}

type InsertRowResult = {
	row: Row;
	inserted: boolean;
};

type InsertRowsResult = {
	rows: Row[];
	inserted: boolean;
};

function insertRowIntoSubtree(
	row: Row,
	targetRowId: string,
	rowToInsert: Row,
	destinationIndex: number,
	destinationType: ContainerType,
): InsertRowResult {
	if (row.id === targetRowId) {
		if (destinationType === "child") {
			return {
				row: withContentUpdate(row, { child: rowToInsert }),
				inserted: true,
			};
		}

		return {
			row: withContentUpdate(row, {
				children: insertRowAtIndex(
					row.config.view.content.children ?? [],
					rowToInsert,
					destinationIndex,
				),
			}),
			inserted: true,
		};
	}

	const child = row.config.view.content.child;
	if (child) {
		const childResult = insertRowIntoSubtree(
			child,
			targetRowId,
			rowToInsert,
			destinationIndex,
			destinationType,
		);
		if (childResult.inserted) {
			return {
				row: withContentUpdate(row, { child: childResult.row }),
				inserted: true,
			};
		}
	}

	const children = row.config.view.content.children;
	if (children) {
		for (const [index, childRow] of children.entries()) {
			const childResult = insertRowIntoSubtree(
				childRow,
				targetRowId,
				rowToInsert,
				destinationIndex,
				destinationType,
			);
			if (!childResult.inserted) continue;

			const updatedChildren = [...children];
			updatedChildren[index] = childResult.row;
			return {
				row: withContentUpdate(row, { children: updatedChildren }),
				inserted: true,
			};
		}
	}

	return { row, inserted: false };
}

export function insertRowIntoTree(
	rows: Row[],
	rowToInsert: Row,
	destinationIndex: number,
	destinationContainer?: { rowId: string; type: ContainerType },
): InsertRowsResult {
	if (!destinationContainer) {
		return {
			rows: insertRowAtIndex(rows, rowToInsert, destinationIndex),
			inserted: true,
		};
	}

	for (const [index, row] of rows.entries()) {
		const result = insertRowIntoSubtree(
			row,
			destinationContainer.rowId,
			rowToInsert,
			destinationIndex,
			destinationContainer.type,
		);
		if (!result.inserted) continue;

		const updatedRows = [...rows];
		updatedRows[index] = result.row;
		return { rows: updatedRows, inserted: true };
	}

	return { rows, inserted: false };
}

function updateRowInSubtree(
	row: Row,
	targetRowId: string,
	updater: (row: Row) => Row,
): Row | null {
	if (row.id === targetRowId) {
		return updater(row);
	}
	if (row.config.view.content.children) {
		const updatedChildren = row.config.view.content.children.map(
			(child) => updateRowInSubtree(child, targetRowId, updater) ?? child,
		);
		const childUpdated = updatedChildren.some(
			(child, index) => child !== row.config.view.content.children?.[index],
		);
		if (childUpdated) {
			return withContentUpdate(row, { children: updatedChildren });
		}
	}
	if (row.config.view.content.child) {
		const updatedChild = updateRowInSubtree(
			row.config.view.content.child,
			targetRowId,
			updater,
		);
		if (updatedChild) {
			return withContentUpdate(row, { child: updatedChild });
		}
	}
	return null;
}

export function updateRowInTree(
	rows: Row[],
	targetRowId: string,
	updater: (row: Row) => Row,
): Row[] {
	return rows.map(
		(row) => updateRowInSubtree(row, targetRowId, updater) ?? row,
	);
}

// -- DEDUPLICATED PAGE-LEVEL CONTAINER HELPERS --

function findContainerInPage(
	page: UI_Page,
	rowId: string,
	searcher: (
		rowId: string,
		rows: Row[],
	) => { container: Row; type: ContainerType } | null,
	skipFooterRootCheck?: boolean,
): { container: Row; type: ContainerType } | null {
	const fromRows = searcher(rowId, page.rows);
	if (fromRows) return fromRows;
	if (page.footer) {
		if (skipFooterRootCheck && page.footer.id === rowId) return null;
		return searcher(rowId, [page.footer]);
	}
	return null;
}

export function findContainerOfRowInPage(
	page: UI_Page,
	rowId: string,
): { container: Row; type: ContainerType } | null {
	return findContainerInPage(page, rowId, findContainerOfRow, true);
}

export function findContainerByIdInPage(
	page: UI_Page,
	rowId: string,
): { container: Row; type: ContainerType } | null {
	return findContainerInPage(page, rowId, findContainerById);
}

export function removeRowFromPage(page: UI_Page, targetRowId: string): UI_Page {
	if (page.footer?.id === targetRowId) {
		return { ...page, footer: undefined };
	}

	if (page.footer) {
		const cleanedFooter = removeRowInSubtree(page.footer, targetRowId);
		if (cleanedFooter !== page.footer) {
			return { ...page, footer: cleanedFooter };
		}
	}

	return {
		...page,
		rows: removeRowFromTree(page.rows, targetRowId),
	};
}

export function insertRowIntoPage(
	page: UI_Page,
	rowToInsert: Row,
	destinationIndex: number,
	destinationContainer?: { rowId: string; type: ContainerType },
): UI_Page {
	if (!destinationContainer) {
		return {
			...page,
			rows: insertRowAtIndex(page.rows, rowToInsert, destinationIndex),
		};
	}

	// Try inserting into page rows first
	const treeResult = insertRowIntoTree(
		page.rows,
		rowToInsert,
		destinationIndex,
		destinationContainer,
	);
	if (treeResult.inserted) {
		return { ...page, rows: treeResult.rows };
	}

	// Fallback: try inserting into the footer
	if (page.footer) {
		for (const row of [page.footer]) {
			const result = insertRowIntoSubtree(
				row,
				destinationContainer.rowId,
				rowToInsert,
				destinationIndex,
				destinationContainer.type,
			);
			if (!result.inserted) continue;

			return { ...page, footer: result.row };
		}
	}

	return page;
}
