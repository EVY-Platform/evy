import { useCallback } from "react";

import type { Row, ContainerType } from "../types/row";
import { useFlowsContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";
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
	const shouldShowIndicators = showIndicators && !isInRowsPanel;

	const selectNestedRow = useCallback(
		(nestedRowId: string) => {
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId: nestedRowId });
		},
		[dispatchRow],
	);

	if (!rows?.length) {
		return showPlaceholder && !isInRowsPanel ? (
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
					showIndicators={shouldShowIndicators}
				>
					{child.row}
				</DraggableRowContainer>
			))}
		</>
	);
}
