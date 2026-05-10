import invariant from "tiny-invariant";

import type { UI_Page } from "../types/flow";
import type { Row, ContainerType } from "../types/row";

const SECONDARY_PAGE_ID_PREFIX = "secondary:";

function parseSecondarySheetRowId(pageId: string): string | undefined {
	return pageId.startsWith(SECONDARY_PAGE_ID_PREFIX)
		? pageId.slice(SECONDARY_PAGE_ID_PREFIX.length)
		: undefined;
}

export function resolveSourcePageIdFromRaw(
	rawSourcePageId: string,
	pages: UI_Page[],
): string {
	const sheetRowId = parseSecondarySheetRowId(rawSourcePageId);
	if (!sheetRowId) return rawSourcePageId;
	const sourcePage = findPageContainingRow(pages, sheetRowId);
	return sourcePage?.id ?? rawSourcePageId;
}

type ResolvedDropDestinationPage = {
	page: UI_Page;
	resolvedPageId: string;
	secondarySheetRowId: string | undefined;
};

export function resolveDestinationPageFromRawPageId(
	rawDestinationPageId: string,
	pages: UI_Page[],
): ResolvedDropDestinationPage {
	const secondarySheetRowId = parseSecondarySheetRowId(rawDestinationPageId);
	if (secondarySheetRowId) {
		const destinationPage = findPageContainingRow(pages, secondarySheetRowId);
		invariant(
			destinationPage,
			"resolveDestinationPageFromRawPageId: destinationPage is not defined",
		);
		return {
			page: destinationPage,
			resolvedPageId: destinationPage.id,
			secondarySheetRowId,
		};
	}
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
		secondarySheetRowId: undefined,
	};
}

function findPageContainingRow(
	pages: UI_Page[],
	rowId: string,
): UI_Page | undefined {
	return pages.find((page) => findRowInSinglePage(page, rowId));
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

export function findContainerOfRow(
	rowId: string,
	rows: Row[],
): { container: Row; type: ContainerType } | null {
	for (const row of rows) {
		if (row.id === rowId) return null;

		const childMatches = row.config.view.content.child?.id === rowId;
		if (childMatches) return { container: row, type: "child" };

		const childrenMatch = row.config.view.content.children?.some(
			(r) => r.id === rowId,
		);
		if (childrenMatch) return { container: row, type: "children" };

		if (row.config.view.content.child) {
			const childrenOfChild = findContainerOfRow(rowId, [
				row.config.view.content.child,
			]);
			if (childrenOfChild) return childrenOfChild;
		}

		if (row.config.view.content.children) {
			const childrenOfChildren = findContainerOfRow(
				rowId,
				row.config.view.content.children,
			);
			if (childrenOfChildren) return childrenOfChildren;
		}
	}
	return null;
}

export function findContainerById(
	rowId: string,
	rows: Row[],
): { container: Row; type: ContainerType } | null {
	for (const row of rows) {
		if ("child" in row.config.view.content && row.id === rowId) {
			return { container: row, type: "child" };
		}

		if ("children" in row.config.view.content && row.id === rowId) {
			return { container: row, type: "children" };
		}

		if (row.config.view.content.child) {
			const child = findContainerById(rowId, [row.config.view.content.child]);
			if (child) return child;
		}

		if (row.config.view.content.children) {
			const children = findContainerById(
				rowId,
				row.config.view.content.children,
			);
			if (children) return children;
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

export function findContainerOfRowInPage(
	page: UI_Page,
	rowId: string,
): { container: Row; type: ContainerType } | null {
	const fromRows = findContainerOfRow(rowId, page.rows);
	if (fromRows) return fromRows;
	if (page.footer) {
		if (page.footer.id === rowId) {
			return null;
		}
		return findContainerOfRow(rowId, [page.footer]);
	}
	return null;
}

export function findContainerByIdInPage(
	page: UI_Page,
	rowId: string,
): { container: Row; type: ContainerType } | null {
	const fromRows = findContainerById(rowId, page.rows);
	if (fromRows) return fromRows;
	if (page.footer) {
		return findContainerById(rowId, [page.footer]);
	}
	return null;
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

	for (const [index, row] of page.rows.entries()) {
		const result = insertRowIntoSubtree(
			row,
			destinationContainer.rowId,
			rowToInsert,
			destinationIndex,
			destinationContainer.type,
		);
		if (!result.inserted) continue;
		const updatedRows = [...page.rows];
		updatedRows[index] = result.row;
		return { ...page, rows: updatedRows };
	}

	if (page.footer) {
		const result = insertRowIntoSubtree(
			page.footer,
			destinationContainer.rowId,
			rowToInsert,
			destinationIndex,
			destinationContainer.type,
		);
		if (result.inserted) {
			return { ...page, footer: result.row };
		}
	}

	return page;
}
