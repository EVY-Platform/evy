import type { DATA_EVY_Row } from "evy-types";
import type { Row } from "../types/row";
import { storedRowToRow } from "../utils/rowCodec";
import { DraggableRowContainer } from "./DraggableRowContainer";

export function buildRowElements(
	rowIds: string[],
	rowsById: Record<string, DATA_EVY_Row>,
	paletteRows: Row[],
	selectRow: (rowId: string) => void,
	forcedIndicators?: {
		rowId: string;
		indicators: Array<"before" | "after">;
	},
) {
	return rowIds.map((rowId) => {
		const record = rowsById[rowId];
		const rowElement = record
			? storedRowToRow(record).row
			: paletteRows.find((r) => r.id === rowId)?.row;
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
