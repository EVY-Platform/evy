import type { Row } from "../types/row";
import { DraggableRowContainer } from "./DraggableRowContainer";

export function buildRowElements(
	rows: Row[],
	selectRow: (rowId: string) => void,
	forcedIndicators?: {
		rowId: string;
		indicators: Array<"before" | "after">;
	},
) {
	return rows.map((row) => {
		const rowForcedIndicators =
			forcedIndicators && forcedIndicators.rowId === row.id
				? forcedIndicators.indicators
				: undefined;
		const rowElement = (
			<DraggableRowContainer
				key={row.id}
				rowId={row.id}
				selectRow={() => selectRow(row.id)}
				showIndicators
				forcedIndicators={rowForcedIndicators}
			>
				{row.row}
			</DraggableRowContainer>
		);

		return (
			<div
				key={row.id}
				className="evy-opacity-50"
				title="Runtime evaluates row visibility on device"
			>
				{rowElement}
			</div>
		);
	});
}
