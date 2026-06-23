import { useCallback } from "react";
import { useFlowsContext } from "../state";
import type { ContainerType, Row } from "../types/row";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { DropPlaceholderShell } from "./DropPlaceholderShell";
import { PlaceholderDropIndicator } from "./PlaceholderDropIndicator";
import { useIsInRowsPanel } from "./RowRenderLocationContext";

export function ContainerChildren({
	rows,
	orientation = "vertical",
	showIndicators = false,
	containerRowId,
	containerType,
	showPlaceholder = true,
}: {
	rows: Row[] | undefined;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	containerRowId: string;
	containerType: ContainerType;
	showPlaceholder?: boolean;
}) {
	const { dispatchRow } = useFlowsContext();
	const isInRowsPanel = useIsInRowsPanel();

	const selectNestedRow = useCallback(
		(nestedRowId: string) => {
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId: nestedRowId });
		},
		[dispatchRow],
	);

	if (!rows?.length) {
		if (isInRowsPanel) {
			return (
				<DropPlaceholderShell isDraggedOver={false}>
					Drop row here
				</DropPlaceholderShell>
			);
		}
		return showPlaceholder ? (
			<PlaceholderDropIndicator
				key="placeholder"
				containerRowId={containerRowId}
				containerType={containerType}
			/>
		) : null;
	}

	return (
		<>
			{rows.map((child) => (
				<DraggableRowContainer
					key={child.id}
					rowId={child.id}
					selectRow={() => selectNestedRow(child.id)}
					orientation={orientation}
					showIndicators={showIndicators && !isInRowsPanel}
				>
					{child.row}
				</DraggableRowContainer>
			))}
		</>
	);
}
