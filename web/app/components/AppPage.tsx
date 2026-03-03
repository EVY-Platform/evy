import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { AppContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";

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
			"AppPage useEffect: scrollableRef.current is not defined",
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
			}),
		);
	}, [pageId, dispatchDropIndicator, dispatchDragging]);

	const selectRow = useCallback(
		(rowId: string) =>
			dispatchRow({
				type: "SET_ACTIVE_ROW",
				pageId,
				rowId,
			}),
		[pageId, dispatchRow],
	);

	const rowElements = useMemo(() => {
		const page = flows
			.find((f) => f.id === activeFlowId)
			?.pages.find((p) => p.id === pageId);
		if (!page) return [];

		const lastIndex = page.rows.length - 1;
		return page.rows.map((row, index) => (
			<DraggableRowContainer
				key={row.id}
				rowId={row.id}
				selectRow={() => selectRow(row.id)}
				showIndicators
				previousRowId={index > 0 ? page.rows[index - 1].id : undefined}
				nextRowId={index < lastIndex ? page.rows[index + 1].id : undefined}
			>
				{row.row}
			</DraggableRowContainer>
		));
	}, [flows, activeFlowId, pageId, selectRow]);

	const footer = flows
		.find((f) => f.id === activeFlowId)
		?.pages.find((p) => p.id === pageId)?.footer;

	return (
		<div className="evy-overflow-hidden evy-p-30px evy-h-full evy-w-full evy-box-sizing-border">
			{footer ? (
				<div className="evy-flex evy-flex-col evy-h-full evy-rounded-24 evy-bg-white">
					<div
						className="evy-overflow-scroll evy-flex-1 evy-pt-4"
						ref={scrollableRef}
					>
						{rowElements}
					</div>
					{/* biome-ignore lint/a11y/useSemanticElements: footer row container needs div for layout consistency */}
					<div
						className="evy-border-t evy-border-gray-light evy-hover:bg-gray-light evy-cursor-pointer evy-rounded-bottom-24"
						onClick={() => selectRow(footer.id)}
						onKeyDown={(e) => e.key === "Enter" && selectRow(footer.id)}
						role="button"
						tabIndex={0}
					>
						{footer.row}
					</div>
				</div>
			) : (
				<div
					className="evy-overflow-scroll evy-h-full evy-rounded-24 evy-pt-4 evy-bg-white"
					ref={scrollableRef}
				>
					{rowElements}
				</div>
			)}
		</div>
	);
}
