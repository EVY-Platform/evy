import { useCallback } from "react";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { useIsInRowsPanel } from "./RowRenderLocationContext";
import { resolveRowElement } from "./resolveRowElement";

export function ContainerChildTemplate({
	childRowId,
	source,
	orientation = "vertical",
}: {
	childRowId?: string;
	source?: string;
	orientation?: "horizontal" | "vertical";
}) {
	const { dispatchRow, rowsById, rows: paletteRows } = useFlowsContext();
	const isInRowsPanel = useIsInRowsPanel();

	const selectNestedRow = useCallback(
		(nestedRowId: string) => {
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId: nestedRowId });
		},
		[dispatchRow],
	);

	if (isInRowsPanel || !childRowId) {
		return null;
	}

	const hint = source?.trim()
		? "Template — repeats per source item"
		: "Child template";

	return (
		<div
			className="evy-mb-2 evy-rounded-md evy-border evy-border-dashed evy-border-gray-400 evy-p-2"
			data-testid="container-child-template"
		>
			<div className="evy-mb-1 evy-text-xs evy-text-gray-500">{hint}</div>
			<DraggableRowContainer
				rowId={childRowId}
				selectRow={() => selectNestedRow(childRowId)}
				orientation={orientation}
				showIndicators={false}
			>
				{resolveRowElement(childRowId, rowsById, paletteRows)}
			</DraggableRowContainer>
		</div>
	);
}
