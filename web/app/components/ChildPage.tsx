import { useCallback, useRef } from "react";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useRowById } from "../hooks/useRowById";
import { useDragContext, useFlowsContext } from "../state";
import { ChildPageFrame } from "./ChildPageFrame";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { baseTitleStyle } from "./pageStyles";

export function ChildPage({
	childRowId,
	pageId,
	parentRowId,
	variant,
}: {
	childRowId: string;
	pageId: string;
	parentRowId: string;
	variant: "full" | "sheet";
}) {
	const { dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const row = useRowById(childRowId);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData: { destinationContainerRowId: parentRowId },
	});

	const selectChild = useCallback(() => {
		dispatchRow({ type: "SET_ACTIVE_ROW", rowId: childRowId });
	}, [dispatchRow, childRowId]);

	const heading = variant === "full" ? "Search result" : "Sheet overlay";

	return (
		<ChildPageFrame scrollableRef={scrollableRef} variant={variant}>
			<h2 style={baseTitleStyle}>{heading}</h2>
			{row && (
				<DraggableRowContainer
					rowId={childRowId}
					selectRow={selectChild}
					showIndicators
				>
					{row.row}
				</DraggableRowContainer>
			)}
		</ChildPageFrame>
	);
}
