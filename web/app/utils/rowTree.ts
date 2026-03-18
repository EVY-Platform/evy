import type { Row, ContainerType } from "../types/row";

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
	].filter((r) => r !== undefined);
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
	if (row.config.view.content.children) {
		const filteredChildren = row.config.view.content.children.filter(
			(child) => child.id !== targetRowId,
		);
		const updatedChildren = filteredChildren.map((child) =>
			removeRowInSubtree(child, targetRowId),
		);
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
	if (row.config.view.content.child?.id === targetRowId) {
		return {
			...row,
			config: {
				...row.config,
				view: {
					...row.config.view,
					content: {
						...row.config.view.content,
						child: undefined,
					},
				},
			},
		};
	}
	if (row.config.view.content.child) {
		return {
			...row,
			config: {
				...row.config,
				view: {
					...row.config.view,
					content: {
						...row.config.view.content,
						child: removeRowInSubtree(
							row.config.view.content.child,
							targetRowId,
						),
					},
				},
			},
		};
	}
	return row;
}

export function removeRowFromTree(rows: Row[], targetRowId: string): Row[] {
	return rows
		.filter((r) => r.id !== targetRowId)
		.map((r) => removeRowInSubtree(r, targetRowId));
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
