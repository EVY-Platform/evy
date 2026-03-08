import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { AppContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";

export default function AppPage({ pageId }: { pageId: string }) {
	const { flows, activeFlowId, dispatchRow, dispatchDropIndicator } =
		useContext(AppContext);

	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const selectRow = useCallback(
		(rowId: string) =>
			dispatchRow({
				type: "SET_ACTIVE_ROW",
				pageId,
				rowId,
			}),
		[pageId, dispatchRow],
	);

	const selectPage = useCallback(
		(e: MouseEvent) => {
			if (e.target === e.currentTarget) {
				dispatchRow({ type: "SET_ACTIVE_PAGE", pageId });
			}
		},
		[pageId, dispatchRow],
	);

	useEffect(() => {
		invariant(
			scrollableRef.current,
			"AppPage useEffect: scrollableRef.current is not defined",
		);
		const element = scrollableRef.current;
		element.addEventListener("click", selectPage);
		const cleanup = combine(
			dropTargetForElements({
				element,
				getData: () => ({ pageId }),
				canDrop: () => true,
				onDrop: () => {
					dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE" });
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
				element,
				canScroll: () => true,
			}),
		);
		return () => {
			element.removeEventListener("click", selectPage);
			cleanup();
		};
	}, [pageId, selectPage, dispatchDropIndicator]);

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

	const page = flows
		.find((f) => f.id === activeFlowId)
		?.pages.find((p) => p.id === pageId);

	const titleElement = page?.title ? (
		<button
			type="button"
			className="evy-page-title evy-cursor-pointer"
			onClick={() => dispatchRow({ type: "SET_ACTIVE_PAGE", pageId })}
		>
			{page.title}
		</button>
	) : null;

	const footer = page?.footer;

	return (
		<div className="evy-overflow-hidden evy-p-30px evy-h-full evy-w-full evy-box-sizing-border">
			{footer ? (
				<div className="evy-flex evy-flex-col evy-h-full evy-rounded-24 evy-bg-white">
					{titleElement}
					<div
						className="evy-overflow-scroll evy-flex-1 evy-pt-4"
						ref={scrollableRef}
					>
						{rowElements}
					</div>
					<button
						type="button"
						className="evy-border-none evy-hover:bg-gray-light evy-cursor-pointer evy-rounded-bottom-24 evy-w-full evy-bg-white evy-p-0"
						onClick={() => selectRow(footer.id)}
					>
						{footer.row}
					</button>
				</div>
			) : (
				<div
					className="evy-overflow-scroll evy-h-full evy-rounded-24 evy-pt-4 evy-bg-white"
					ref={scrollableRef}
				>
					{titleElement}
					{rowElements}
				</div>
			)}
		</div>
	);
}
