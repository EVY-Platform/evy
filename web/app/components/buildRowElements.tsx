import type { DATA_EVY_Row } from "evy-types";
import type { Row } from "../types/row";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { resolveRowElement } from "./resolveRowElement";

export function buildRowElements(
	row_ids: string[],
	rowsById: Record<string, DATA_EVY_Row>,
	paletteRows: Row[],
	selectRow: (rowId: string) => void,
	forcedIndicators?: {
		rowId: string;
		indicators: Array<"before" | "after">;
	},
) {
	return row_ids.map((rowId) => {
		const rowElement = resolveRowElement(rowId, rowsById, paletteRows);
		const rowForcedIndicators =
			forcedIndicators && forcedIndicators.rowId === rowId
				? forcedIndicators.indicators
				: undefined;
		return (
			<DraggableRowContainer
				key={rowId}
				rowId={rowId}
				selectRow={() => selectRow(rowId)}
				showIndicators
				forcedIndicators={rowForcedIndicators}
			>
				{rowElement}
			</DraggableRowContainer>
		);
	});
}
