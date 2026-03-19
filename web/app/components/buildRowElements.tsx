import type { Row } from "../types/row";
import { DraggableRowContainer } from "./DraggableRowContainer";

export function buildRowElements(
	rows: Row[],
	selectRow: (rowId: string) => void,
) {
	const lastIndex = rows.length - 1;
	return rows.map((row, index) => (
		<DraggableRowContainer
			key={row.id}
			rowId={row.id}
			selectRow={() => selectRow(row.id)}
			showIndicators
			previousRowId={index > 0 ? rows[index - 1].id : undefined}
			nextRowId={index < lastIndex ? rows[index + 1].id : undefined}
		>
			{row.row}
		</DraggableRowContainer>
	));
}
