import type { Row } from "../types/row";
import { findRowInPages } from "./rowTree";

type ActiveChildPage = {
	childRow: Row;
	parentRowId: string;
};

/**
 * Builds the chain of child pages for the current active selection,
 * walking down the config stack to collect rendered rows.
 */
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
		const singularChild = currentParentRow.config.view.content.child;
		if (singularChild?.id === selectedDescendantRowId) {
			childPages.push({
				childRow: singularChild,
				parentRowId: currentParentRow.id,
			});
			currentParentRow = singularChild;
			continue;
		}

		const nestedChild = currentParentRow.config.view.content.children?.find(
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

	const nextChildRow = currentParentRow.config.view.content.child;
	if (nextChildRow) {
		childPages.push({
			childRow: nextChildRow,
			parentRowId: currentParentRow.id,
		});
	}

	return childPages;
}
