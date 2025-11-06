import { useEffect, useContext, useRef, useCallback, useMemo } from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { DraggableRowContainer } from "./DraggableRowContainer";
import { AppContext } from "../registry";

export default function AppPage({ pageId }: { pageId: string }) {
	const {
		flows,
		activeFlowId,
		dispatchRow,
		dispatchDragging,
		dispatchDropIndicator,
	} = useContext(AppContext);

	const scrollableRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		invariant(
			scrollableRef.current,
			"AppPage useEffect: scrollableRef.current is not defined"
		);
		return combine(
			dropTargetForElements({
				element: scrollableRef.current,
				getData: () => ({ pageId }),
				canDrop: () => true,
				onDrop: () => {
					dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE" });
					dispatchDragging({ type: "STOP_DRAGGING" });
				},
				onDragEnter: () =>
					dispatchDropIndicator({
						type: "SET_INDICATOR_PAGE",
						pageId: pageId,
					}),
				onDragLeave: () =>
					dispatchDropIndicator({
						type: "UNSET_INDICATOR_PAGE",
					}),
			}),
			autoScrollForElements({
				element: scrollableRef.current,
				canScroll: () => true,
			})
		);
	}, [scrollableRef, pageId, dispatchDropIndicator]);

	const selectRow = useCallback(
		(rowId: string) =>
			dispatchRow({
				type: "SET_ACTIVE_ROW",
				pageId: pageId,
				rowId: rowId,
			}),
		[pageId, dispatchRow]
	);

	const rowElements = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.find((p) => p.id === pageId)
				?.rows?.map((row, index) => (
					<DraggableRowContainer
						key={row.rowId}
						rowId={row.rowId}
						selectRow={() => selectRow(row.rowId)}
						showDropzoneBefore={index === 0}
						showDropzoneAfter
					>
						{row.row}
					</DraggableRowContainer>
				)),
		[flows, activeFlowId, pageId, selectRow]
	);

	return (
		<div className="evy-overflow-hidden evy-p-30px evy-h-full evy-w-full evy-box-sizing-border">
			<div
				className="evy-overflow-scroll evy-h-full evy-rounded-24 evy-pt-4 evy-bg-white"
				ref={scrollableRef}
			>
				{rowElements}
			</div>
		</div>
	);
}
