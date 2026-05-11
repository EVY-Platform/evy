import { useCallback, useRef } from "react";

import type { Row } from "../types/row";
import { useDragContext, useFlowsContext } from "../state";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { baseTitleStyle } from "./pageStyles";
import { ChildPageFrame } from "./ChildPageFrame";

/**
 * Renders a child row as a secondary phone-page immediately to the right
 * of the active page. Clicking the child row selects it, making it the
 * active element so its own child page can appear.
 */
export function ChildPage({
	childRow,
	pageId,
	parentRowId,
	variant,
}: {
	childRow: Row;
	pageId: string;
	parentRowId: string;
	variant: "full" | "sheet";
}) {
	const { dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData: { destinationContainerRowId: parentRowId },
	});

	const selectChild = useCallback(() => {
		dispatchRow({ type: "SET_ACTIVE_ROW", rowId: childRow.id });
	}, [dispatchRow, childRow.id]);

	const heading = variant === "full" ? "Search result" : "Sheet overlay";

	return (
		<ChildPageFrame scrollableRef={scrollableRef} variant={variant}>
			<h2 style={baseTitleStyle}>{heading}</h2>
			<DraggableRowContainer
				rowId={childRow.id}
				selectRow={selectChild}
				showIndicators
			>
				{childRow.row}
			</DraggableRowContainer>
		</ChildPageFrame>
	);
}
