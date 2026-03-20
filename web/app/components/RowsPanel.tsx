import { useEffect, useMemo, useRef, useState } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { useDragContext, useFlowsContext } from "../state";
import { CancelOverlay } from "./CancelOverlay";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { SearchInput } from "./SearchInput";

export function RowsPanel() {
	const pageInnerRef = useRef<HTMLDivElement | null>(null);
	const { rows } = useFlowsContext();
	const { dragging, dispatchDragging } = useDragContext();
	const [searchQuery, setSearchQuery] = useState("");

	const filteredRows = useMemo(() => {
		const query = searchQuery.toLowerCase();
		if (!query) return rows;
		return rows.filter((row) => row.id.toLowerCase().includes(query));
	}, [rows, searchQuery]);

	useEffect(() => {
		invariant(
			pageInnerRef.current,
			"RowsPanel useEffect: pageInnerRef.current is not defined",
		);
		return combine(
			dropTargetForElements({
				element: pageInnerRef.current,
				getData: () => ({ pageId: "rows" }),
				canDrop: () => true,
				onDragStart: () =>
					dispatchDragging({ type: "START_DRAGGING", source: "rows" }),
				onDrop: () => dispatchDragging({ type: "STOP_DRAGGING" }),
			}),
		);
	}, [dispatchDragging]);

	return (
		<div className="evy-flex evy-flex-col evy-relative evy-w-full evy-h-full">
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-bg-white">
				Rows
			</div>
			<SearchInput
				value={searchQuery}
				onChange={setSearchQuery}
				placeholder="Button, Calendar, etc..."
			/>
			<div
				className={`evy-flex evy-flex-col evy-flex-1 evy-gap-2 ${
					dragging ? "evy-overflow-hidden" : "evy-overflow-y-auto"
				}`}
				ref={pageInnerRef}
			>
				{filteredRows.map((row) => (
					<DraggableRowContainer key={row.id} rowId={row.id}>
						{row.row}
					</DraggableRowContainer>
				))}
				{filteredRows.length === 0 && searchQuery && (
					<div className="evy-text-sm evy-text-gray evy-text-center evy-mt-8">
						No rows match &ldquo;{searchQuery}&rdquo;
					</div>
				)}
			</div>
			{dragging && (
				<CancelOverlay
					dismiss={() => dispatchDragging({ type: "STOP_DRAGGING" })}
				/>
			)}
		</div>
	);
}
