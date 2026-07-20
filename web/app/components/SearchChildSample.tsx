import { useCallback } from "react";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { PlaceholderDropIndicator } from "./PlaceholderDropIndicator";
import { useIsInRowsPanel } from "./RowRenderLocationContext";
import { resolveRowElement } from "./resolveRowElement";

export function SearchChildSample({
	searchRowId,
	childRowId,
}: {
	searchRowId: string;
	childRowId?: string;
}) {
	const { dispatchRow, rowsById, rows: paletteRows } = useFlowsContext();
	const isInRowsPanel = useIsInRowsPanel();

	const selectChildRow = useCallback(
		(nestedRowId: string) => {
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId: nestedRowId });
		},
		[dispatchRow],
	);

	if (isInRowsPanel) {
		return null;
	}

	if (!childRowId) {
		return (
			<div className="evy-mt-2" data-testid="search-child-drop-target">
				<PlaceholderDropIndicator
					containerRowId={searchRowId}
					containerType="child"
				/>
			</div>
		);
	}

	return (
		<div className="evy-mt-2" data-testid="search-child-sample">
			<DraggableRowContainer
				rowId={childRowId}
				selectRow={() => selectChildRow(childRowId)}
				showIndicators={false}
			>
				{resolveRowElement(childRowId, rowsById, paletteRows)}
			</DraggableRowContainer>
		</div>
	);
}
