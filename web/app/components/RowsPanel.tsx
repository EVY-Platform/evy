import { useContext, useEffect, useRef } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { AppContext } from "../state";
import { CancelOverlay } from "./CancelOverlay";
import { DraggableRowContainer } from "./DraggableRowContainer";

export function RowsPanel() {
	const pageInnerRef = useRef<HTMLDivElement | null>(null);
	const { rows, dragging, dispatchDragging } = useContext(AppContext);

	useEffect(() => {
		invariant(
			pageInnerRef.current,
			"RowsPanel useEffect: pageInnerRef.current is not defined"
		);
		return combine(
			dropTargetForElements({
				element: pageInnerRef.current,
				getData: () => ({ pageId: "rows" }),
				canDrop: () => true,
				onDragStart: () => dispatchDragging({ type: "START_DRAGGING" }),
				onDrop: () => dispatchDragging({ type: "STOP_DRAGGING" }),
			})
		);
	}, [dispatchDragging]);

	return (
		<div className="evy-flex evy-flex-col evy-relative evy-w-full evy-h-full">
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
				Rows
			</div>
			<div
				className={`evy-flex evy-flex-col evy-flex-1 evy-gap-2 ${
					dragging ? "evy-overflow-hidden" : "evy-overflow-y-auto"
				}`}
				ref={pageInnerRef}
			>
				{rows.map((row) => (
					<DraggableRowContainer key={row.rowId} rowId={row.rowId}>
						{row.row}
					</DraggableRowContainer>
				))}
			</div>
			{dragging && (
				<CancelOverlay
					dismiss={() => dispatchDragging({ type: "STOP_DRAGGING" })}
				/>
			)}
		</div>
	);
}
