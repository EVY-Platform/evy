import type { DATA_EVY_Row } from "evy-types";

export type ActiveChildPage = {
	childRowId: string;
	parentRowId: string;
};

export function buildActiveChildPages({
	activeRowId,
	configStack,
	rowsById,
}: {
	activeRowId: string | undefined;
	configStack: string[];
	rowsById: Record<string, DATA_EVY_Row>;
}): ActiveChildPage[] {
	if (!activeRowId) return [];

	const childPages: ActiveChildPage[] = [];
	let currentRowId = activeRowId;

	for (const descendantId of configStack) {
		const currentRow = rowsById[currentRowId];
		if (!currentRow) break;
		const childRowId = currentRow.data.child_row_id;
		const childrenRowIds = Array.isArray(currentRow.data.children_row_ids)
			? (currentRow.data.children_row_ids as string[])
			: [];

		if (childRowId === descendantId) {
			childPages.push({
				childRowId: descendantId,
				parentRowId: currentRowId,
			});
			currentRowId = descendantId;
			continue;
		}

		if (childrenRowIds.includes(descendantId)) {
			currentRowId = descendantId;
			continue;
		}

		// Fallback: treat as if it's a root-level row jump
		if (rowsById[descendantId]) {
			currentRowId = descendantId;
		} else {
			break;
		}
	}

	// After walking the configStack, check if the final row has a singular child
	const finalRow = rowsById[currentRowId];
	if (finalRow) {
		const childRowId = finalRow.data.child_row_id;
		if (typeof childRowId === "string") {
			childPages.push({ childRowId, parentRowId: currentRowId });
		}
	}

	return childPages;
}
