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
		<div className="flex relative w-full">
			<div className="flex flex-col" ref={pageInnerRef}>
				<div className="p-4 text-xl font-bold text-center">Rows</div>
				<div className="flex flex-col min-h-full p-2 gap-2">
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
