import { useContext, useEffect, useRef } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { DraggableRowContainer } from "./DraggableRowContainer";
import { AppContext } from "../registry";
import { CancelOverlay } from "./CancelOverlay";

export function RowsPanel() {
	const pageInnerRef = useRef<HTMLDivElement | null>(null);
	const { rows, dragging, dispatchDragging } = useContext(AppContext);

	useEffect(() => {
		invariant(pageInnerRef.current);
		return combine(
			dropTargetForElements({
				element: pageInnerRef.current,
				getData: () => ({ pageId: "rows" }),
				canDrop: () => true,
				onDragStart: () =>
					dispatchDragging({ type: "SET_DRAGGING", dragging: true }),
				onDrop: () =>
					dispatchDragging({ type: "SET_DRAGGING", dragging: false }),
			})
		);
	}, [pageInnerRef, dispatchDragging]);

	return (
		<div className="evy-flex evy-relative evy-w-full evy-h-full">
			<div
				className="evy-flex evy-flex-col evy-w-full"
				ref={pageInnerRef}
			>
				<div className="evy-p-4 evy-py-6 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
					Rows
				</div>
				<div className="evy-flex evy-flex-col evy-min-h-full evy-gap-2">
					{rows.map((row) => (
						<DraggableRowContainer
							key={row.rowId}
							rowId={row.rowId}
						>
							{row.row}
						</DraggableRowContainer>
					))}
				</div>
				{dragging && (
					<CancelOverlay
						dismiss={() =>
							dispatchDragging({
								type: "SET_DRAGGING",
								dragging: false,
							})
						}
					/>
				)}
			</div>
		</div>
	);
}
