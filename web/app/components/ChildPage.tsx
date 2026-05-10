import { useCallback, useRef } from "react";

import type { Row } from "../types/row";
import { useFlowsContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { baseTitleStyle, rounded24Style } from "./pageStyles";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";

/**
 * Renders a child row as a secondary phone-page immediately to the right
 * of the active page. Clicking the child row selects it, making it the
 * active element so its own child page can appear.
 */
export function ChildPage({ childRow }: { childRow: Row }) {
	const { dispatchRow } = useFlowsContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const selectChild = useCallback(() => {
		dispatchRow({ type: "SET_ACTIVE_ROW", rowId: childRow.id });
	}, [dispatchRow, childRow.id]);

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--size-30px)" }}
		>
			<div
				className="evy-overflow-scroll evy-flex evy-flex-col evy-h-full evy-bg-white"
				style={rounded24Style}
				{...canvasPageInteriorDomProps}
				ref={scrollableRef}
			>
				<h2 style={baseTitleStyle}>Child Row</h2>
				<DraggableRowContainer
					rowId={childRow.id}
					selectRow={selectChild}
					showIndicators
				>
					{childRow.row}
				</DraggableRowContainer>
			</div>
		</div>
	);
}
