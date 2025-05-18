"use client";

import { useContext, useEffect, useRef } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { DraggableRowContainer } from "./DraggableRowContainer.tsx";
import { AppContext, baseRows } from "../registry.tsx";
import { CancelOverlay } from "./CancelOverlay.tsx";

export function RowsPanel() {
	const pageInnerRef = useRef<HTMLDivElement | null>(null);
	const { dragging, dispatchDragging } = useContext(AppContext);

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
	}, []);

	return (
		<div className="flex relative w-full bg-evy-light-gray">
			<div className="flex flex-col" ref={pageInnerRef}>
				<div className="p-4 text-xl font-bold text-center">Rows</div>
				<div className="flex flex-col min-h-full p-2 gap-2">
					{baseRows.map((Row) => {
						const props = Object.fromEntries(
							Row.config.map((c) => [c.id, c.value])
						);
						return (
							<DraggableRowContainer
								key={Row.name}
								rowId={Row.name}
							>
								<Row
									key={Row.name}
									rowId={Row.name}
									{...props}
								/>
							</DraggableRowContainer>
						);
					})}
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
