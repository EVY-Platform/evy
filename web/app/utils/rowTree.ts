import invariant from "tiny-invariant";

import type { SDUI_Page } from "../types/flow";
import type { Row, ContainerType } from "../types/row";

const SECONDARY_PAGE_ID_PREFIX = "secondary:";

/** If `pageId` is a secondary-sheet pseudo id, returns the host row id; otherwise `undefined`. */
export function parseSecondarySheetRowId(pageId: string): string | undefined {
	return pageId.startsWith(SECONDARY_PAGE_ID_PREFIX)
		? pageId.slice(SECONDARY_PAGE_ID_PREFIX.length)
		: undefined;
}

/**
 * Maps a drag `pageId` from initial drop targets to the real page id
 * (secondary pseudo ids resolve via the sheet host row).
 */
export function resolveSourcePageIdFromRaw(
	rawSourcePageId: string,
	pages: SDUI_Page[],
): string {
	const sheetRowId = parseSecondarySheetRowId(rawSourcePageId);
	if (!sheetRowId) return rawSourcePageId;
	const sourcePage = findPageContainingRow(pages, sheetRowId);
	return sourcePage?.id ?? rawSourcePageId;
}

export type ResolvedDropDestinationPage = {
	page: SDUI_Page;
	resolvedPageId: string;
	secondarySheetRowId: string | undefined;
};

/** Resolves destination drop target `pageId` (including `secondary:*`) to a real page. */
export function resolveDestinationPageFromRawPageId(
	rawDestinationPageId: string,
	pages: SDUI_Page[],
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

/** Page whose top-level `rows` contains the given row id (not recursive). */
export function findPageContainingRow(
	pages: SDUI_Page[],
	rowId: string,
): SDUI_Page | undefined {
	return pages.find((page) => page.rows.some((r) => r.id === rowId));
}

export function findRowInPages(
	rowId: string,
	pages: { rows: Row[] }[],
): Row | undefined {
	for (const page of pages) {
		for (const row of page.rows) {
			const found = getRowsRecursive(row).find((r) => r.id === rowId);
			if (found) return found;
		}
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

export function traverseToRowAndGetPath(
	row: Row,
	targetRowId: string,
): Array<number | "child"> {
	if (row.id === targetRowId) return [];

	const child = row.config.view.content.child;
	if (child?.id === targetRowId) {
		const path = traverseToRowAndGetPath(child, targetRowId);
		if (path.length > 0) return ["child", ...path];
	}

	const children = row.config.view.content.children;
	if (children) {
		for (const [index, c] of children.entries()) {
			if (c.id === targetRowId) return [index];

			const path = traverseToRowAndGetPath(c, targetRowId);
			if (path.length > 0) return [index, ...path];
		}
	}
	return [];
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
			nextRow = {
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							children: updatedChildren,
						},
					},
				},
			};
		}
	}

	// Some container rows expose both `children` and a single `child`.
	// We must keep traversing after the `children` pass so moves/removals from
	// sheet-like containers do not leave the nested `child` behind.
	if (nextRow.config.view.content.child?.id === targetRowId) {
		return {
			...nextRow,
			config: {
				...nextRow.config,
				view: {
					...nextRow.config.view,
					content: {
						...nextRow.config.view.content,
						child: undefined,
					},
				},
			},
		};
	}

	if (nextRow.config.view.content.child) {
		const updatedChild = removeRowInSubtree(
			nextRow.config.view.content.child,
			targetRowId,
		);
		if (updatedChild !== nextRow.config.view.content.child) {
			return {
				...nextRow,
				config: {
					...nextRow.config,
					view: {
						...nextRow.config.view,
						content: {
							...nextRow.config.view.content,
							child: updatedChild,
						},
					},
				},
			};
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

function insertRowIntoSubtree(
	row: Row,
	targetRowId: string,
	rowToInsert: Row,
	destinationIndex: number,
	destinationType: ContainerType,
): Row | null {
	if (row.id === targetRowId) {
		// Drag/drop destinations can point at either a single-slot `child`
		// container or an ordered `children` collection, so insertion needs to
		// preserve both shapes instead of assuming top-level page rows only.
		if (destinationType === "child") {
			return {
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							child: rowToInsert,
						},
					},
				},
			};
		}

		return {
			...row,
			config: {
				...row.config,
				view: {
					...row.config.view,
					content: {
						...row.config.view.content,
						children: insertRowAtIndex(
							row.config.view.content.children ?? [],
							rowToInsert,
							destinationIndex,
						),
					},
				},
			},
		};
	}

	if (row.config.view.content.children) {
		const updatedChildren = row.config.view.content.children.map(
			(child) =>
				insertRowIntoSubtree(
					child,
					targetRowId,
					rowToInsert,
					destinationIndex,
					destinationType,
				) ?? child,
		);
		const childUpdated = updatedChildren.some(
			(child, index) => child !== row.config.view.content.children?.[index],
		);
		if (childUpdated) {
			return {
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							children: updatedChildren,
						},
					},
				},
			};
		}
	}

	if (row.config.view.content.child) {
		const updatedChild = insertRowIntoSubtree(
			row.config.view.content.child,
			targetRowId,
			rowToInsert,
			destinationIndex,
			destinationType,
		);
		if (updatedChild) {
			return {
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							child: updatedChild,
						},
					},
				},
			};
		}
	}

	return null;
}

export function insertRowIntoTree(
	rows: Row[],
	rowToInsert: Row,
	destinationIndex: number,
	destinationContainer?: { rowId: string; type: ContainerType },
): Row[] {
	// Shared by ADD_ROW and MOVE_ROW so both code paths support nested drop
	// targets. The previous crash happened because MOVE_ROW only knew how to
	// reinsert into top-level page rows.
	if (!destinationContainer) {
		return insertRowAtIndex(rows, rowToInsert, destinationIndex);
	}

	let inserted = false;
	const updatedRows = rows.map((row) => {
		const updatedRow = insertRowIntoSubtree(
			row,
			destinationContainer.rowId,
			rowToInsert,
			destinationIndex,
			destinationContainer.type,
		);
		if (!updatedRow) return row;
		inserted = true;
		return updatedRow;
	});

	invariant(
		inserted,
		"insertRowIntoTree: destination container is not defined",
	);
	return updatedRows;
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
			return {
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							children: updatedChildren,
						},
					},
				},
			};
		}
	}
	if (row.config.view.content.child) {
		const updatedChild = updateRowInSubtree(
			row.config.view.content.child,
			targetRowId,
			updater,
		);
		if (updatedChild) {
			return {
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							child: updatedChild,
						},
					},
				},
			};
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
