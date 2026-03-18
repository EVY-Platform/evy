import type { CSSProperties } from "react";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { AppContext } from "../state";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { findRowInPages } from "../utils/rowTree";

const rounded24Style: CSSProperties = {
	borderRadius: "var(--radius-2-4)",
};

const titleStyle: CSSProperties = {
	textAlign: "center",
	fontWeight: "var(--font-semibold)",
	fontSize: "var(--text-xl)",
	padding: "var(--spacing-2) var(--spacing-4)",
};

export default function SecondarySheetPage({
	sheetRowId,
}: {
	sheetRowId: string;
}) {
	const { flows, activeFlowId, dispatchRow, dispatchDropIndicator } =
		useContext(AppContext);
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const sheetRow = useMemo(() => {
		const pages = flows.find((f) => f.id === activeFlowId)?.pages ?? [];
		return findRowInPages(sheetRowId, pages);
	}, [flows, activeFlowId, sheetRowId]);

	const pageId = `secondary:${sheetRowId}`;
	const title = sheetRow?.config.view.content.title ?? "Sheet";
	const childRows = sheetRow?.config.view.content.children ?? [];

	const selectRow = useCallback(
		(rowId: string) => dispatchRow({ type: "SET_ACTIVE_ROW", pageId, rowId }),
		[pageId, dispatchRow],
	);

	useEffect(() => {
		invariant(
			scrollableRef.current,
			"SecondarySheetPage useEffect: scrollableRef.current is not defined",
		);
		const element = scrollableRef.current;
		const cleanup = combine(
			dropTargetForElements({
				element,
				getData: () => ({ pageId, sheetRowId }),
				canDrop: () => true,
				onDrop: () => {
					dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE" });
				},
				onDragEnter: () =>
					dispatchDropIndicator({
						type: "SET_INDICATOR_PAGE",
						pageId,
					}),
				onDragLeave: () =>
					dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE" }),
			}),
			autoScrollForElements({
				element,
				canScroll: () => true,
			}),
		);
		return () => {
			cleanup();
		};
	}, [pageId, sheetRowId, dispatchDropIndicator]);

	const childRowIds = childRows.map((r) => r.id).join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: childRowIds detects in-place array mutations that childRows reference misses
	const rowElements = useMemo(() => {
		const lastIndex = childRows.length - 1;
		return childRows.map((row, index) => (
			<DraggableRowContainer
				key={row.id}
				rowId={row.id}
				selectRow={() => selectRow(row.id)}
				showIndicators
				previousRowId={index > 0 ? childRows[index - 1].id : undefined}
				nextRowId={index < lastIndex ? childRows[index + 1].id : undefined}
			>
				{row.row}
			</DraggableRowContainer>
		));
	}, [childRows, childRowIds, selectRow]);

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--spacing-30px)" }}
		>
			<div
				className="evy-overflow-scroll evy-h-full evy-pt-4 evy-bg-white"
				style={rounded24Style}
				ref={scrollableRef}
			>
				<div style={titleStyle}>{title}</div>
				{rowElements}
			</div>
		</div>
	);
}
