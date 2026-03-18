import type { CSSProperties } from "react";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { AppContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";

const pageTitleStyle: CSSProperties = {
	textAlign: "center",
	fontWeight: "var(--font-semibold)",
	fontSize: "var(--text-xl)",
	padding: "var(--spacing-2) var(--spacing-4)",
	width: "100%",
	background: "none",
	border: "none",
};

const rounded24Style: CSSProperties = {
	borderRadius: "var(--radius-2-4)",
};

const roundedBottom24Style: CSSProperties = {
	borderBottomLeftRadius: "var(--radius-2-4)",
	borderBottomRightRadius: "var(--radius-2-4)",
};

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

	const page = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.find((p) => p.id === pageId),
		[flows, activeFlowId, pageId],
	);

	const rowElements = useMemo(() => {
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
	}, [page, selectRow]);

	const titleElement = page?.title ? (
		<button
			type="button"
			className="evy-cursor-pointer"
			style={pageTitleStyle}
			onClick={() => dispatchRow({ type: "SET_ACTIVE_PAGE", pageId })}
		>
			{page.title}
		</button>
	) : null;

	const footer = page?.footer;

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--spacing-30px)" }}
		>
			{footer ? (
				<div
					className="evy-flex evy-flex-col evy-h-full evy-bg-white"
					style={rounded24Style}
				>
					{titleElement}
					<div
						className="evy-overflow-scroll evy-flex-1 evy-pt-4"
						ref={scrollableRef}
					>
						{rowElements}
					</div>
					<button
						type="button"
						className="evy-border-none evy-hover:bg-gray-light evy-cursor-pointer evy-w-full evy-bg-white evy-p-0"
						style={roundedBottom24Style}
						onClick={() => selectRow(footer.id)}
					>
						{footer.row}
					</button>
				</div>
			) : (
				<div
					className="evy-overflow-scroll evy-h-full evy-pt-4 evy-bg-white"
					style={rounded24Style}
					ref={scrollableRef}
				>
					{titleElement}
					{rowElements}
				</div>
			)}
		</div>
	);
}
