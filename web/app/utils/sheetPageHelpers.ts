import type { DATA_EVY_Row } from "evy-types";
import { ROW_SHEET_FIELD } from "./rowConstants";

type ActiveSheetPage = {
	sheetRowId: string;
	parentRowId: string;
};

export function buildActiveSheetPages({
	activeRowId,
	configStack,
	rowsById,
}: {
	activeRowId: string | undefined;
	configStack: string[];
	rowsById: Record<string, DATA_EVY_Row>;
}): ActiveSheetPage[] {
	if (!activeRowId) return [];

	const sheetPages: ActiveSheetPage[] = [];
	let currentRowId = activeRowId;

	for (const descendantId of configStack) {
		const currentRow = rowsById[currentRowId];
		if (!currentRow) break;
		const sheetRowId = currentRow.data[ROW_SHEET_FIELD];
		const children_row_ids = Array.isArray(currentRow.data.children_row_ids)
			? (currentRow.data.children_row_ids as string[])
			: [];

		if (sheetRowId === descendantId) {
			sheetPages.push({
				sheetRowId: descendantId,
				parentRowId: currentRowId,
			});
			currentRowId = descendantId;
			continue;
		}

		if (children_row_ids.includes(descendantId)) {
			currentRowId = descendantId;
			continue;
		}

		if (rowsById[descendantId]) {
			currentRowId = descendantId;
		} else {
			break;
		}
	}

	const finalRow = rowsById[currentRowId];
	if (finalRow) {
		const sheetRowId = finalRow.data[ROW_SHEET_FIELD];
		if (typeof sheetRowId === "string") {
			sheetPages.push({ sheetRowId, parentRowId: currentRowId });
		}
	}

	return sheetPages;
}
