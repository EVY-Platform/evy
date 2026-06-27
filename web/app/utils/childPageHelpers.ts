import type { Row } from "../types/row";
import { findRowInPages } from "./rowTree";

type ActiveChildPage = {
	childRow: Row;
	parentRowId: string;
};

export function buildActiveChildPages({
	activeRowId,
	configStack,
	pages,
}: {
	activeRowId: string | undefined;
	configStack: string[];
	pages: { rows: Row[]; footer?: Row }[];
}): ActiveChildPage[] {
	if (!activeRowId) return [];

	const activeRootRow = findRowInPages(activeRowId, pages);
	if (!activeRootRow) return [];

	const childPages: ActiveChildPage[] = [];
	let currentParentRow = activeRootRow;

	for (const selectedDescendantRowId of configStack) {
		const singularChild = currentParentRow.config.child;
		if (singularChild?.id === selectedDescendantRowId) {
			childPages.push({
				childRow: singularChild,
				parentRowId: currentParentRow.id,
			});
			currentParentRow = singularChild;
			continue;
		}

		const nestedChild = currentParentRow.config.children?.find(
			(child) => child.id === selectedDescendantRowId,
		);
		if (nestedChild) {
			currentParentRow = nestedChild;
			continue;
		}

		const fallbackRow = findRowInPages(selectedDescendantRowId, pages);
		if (!fallbackRow) return childPages;
		currentParentRow = fallbackRow;
	}

	const nextChildRow = currentParentRow.config.child;
	if (nextChildRow) {
		childPages.push({
			childRow: nextChildRow,
			parentRowId: currentParentRow.id,
		});
	}

	return childPages;
}
