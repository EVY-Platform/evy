import { useCallback } from "react";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import type { ContainerType } from "../types/row";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { DropPlaceholderShell } from "./DropPlaceholderShell";
import { PlaceholderDropIndicator } from "./PlaceholderDropIndicator";
import { useIsInRowsPanel } from "./RowRenderLocationContext";
import { resolveRowElement } from "./resolveRowElement";

export function ContainerChildren({
	childIds,
	orientation = "vertical",
	showIndicators = false,
	containerRowId,
	containerType,
}: {
	childIds: string[];
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	containerRowId: string;
	containerType: ContainerType;
}) {
	const { dispatchRow, rowsById, rows: paletteRows } = useFlowsContext();
	const isInRowsPanel = useIsInRowsPanel();

	const selectNestedRow = useCallback(
		(nestedRowId: string) => {
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId: nestedRowId });
		},
		[dispatchRow],
	);

	if (childIds.length === 0) {
		if (isInRowsPanel) {
			return (
				<DropPlaceholderShell isDraggedOver={false}>
					Drop row here
				</DropPlaceholderShell>
			);
		}
		return (
			<PlaceholderDropIndicator
				key="placeholder"
				containerRowId={containerRowId}
				containerType={containerType}
			/>
		);
	}

	return (
		<>
			{childIds.map((childId) => {
				const rowElement = resolveRowElement(
					childId,
					rowsById,
					paletteRows,
				);
				return (
					<DraggableRowContainer
						key={childId}
						rowId={childId}
						selectRow={() => selectNestedRow(childId)}
						orientation={orientation}
						showIndicators={showIndicators && !isInRowsPanel}
					>
						{rowElement}
					</DraggableRowContainer>
				);
			})}
		</>
	);
}
