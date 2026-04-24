import { useCallback } from "react";

import type { Row } from "../types/row";
import { useFlowsContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { PlaceholderDropIndicator } from "./PlaceholderDropIndicator";

export function ContainerChildren({
	rows,
	orientation = "vertical",
	showIndicators = false,
	showPlaceholder,
}: {
	rows: Row[] | undefined;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	showPlaceholder: boolean;
}) {
	const { dispatchRow } = useFlowsContext();

	const selectNestedRow = useCallback(
		(nestedRowId: string) => {
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId: nestedRowId });
		},
		[dispatchRow],
	);

	if (!rows?.length) {
		return showPlaceholder ? (
			<PlaceholderDropIndicator key="placeholder" />
		) : null;
	}

	const lastIndex = rows.length - 1;

	return (
		<>
			{rows.map((child, index) => (
				<DraggableRowContainer
					key={child.id}
					rowId={child.id}
					selectRow={() => selectNestedRow(child.id)}
					orientation={orientation}
					showIndicators={showIndicators}
					previousRowId={index > 0 ? rows[index - 1].id : undefined}
					nextRowId={index < lastIndex ? rows[index + 1].id : undefined}
				>
					{child.row}
				</DraggableRowContainer>
			))}
		</>
	);
}
