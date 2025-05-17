"use client";

import { useContext, useEffect, useRef, useState } from "react";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { DraggableRowContainer } from "./DraggableRowContainer.tsx";
import { AppContext, type RowData } from "../registry.tsx";

type State = { type: "idle" } | { type: "is-row-over" };

const idle: State = { type: "idle" };
const isRowOver: State = { type: "is-row-over" };

export function EVYPage({
	pageId,
	rowsData,
	onDrag,
}: {
	pageId: string;
	rowsData: RowData[];
	onDrag: (dragging: boolean) => void;
}) {
	const { dispatchActiveRow } = useContext(AppContext);

	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idle);

	useEffect(() => {
		invariant(scrollableRef.current);
		return combine(
			dropTargetForElements({
				element: scrollableRef.current,
				getData: () => ({ pageId }),
				canDrop: () => true,
				onDragEnter: () => setState(isRowOver),
				onDragLeave: () => setState(idle),
				onDragStart: () => {
					setState(isRowOver);
					onDrag(true);
				},
				onDrop: () => {
					setState(idle);
					onDrag(false);
				},
			}),
			autoScrollForElements({
				element: scrollableRef.current,
				canScroll: () => true,
			})
		);
	}, [pageId]);

	return (
		<div className="overflow-hidden h-165 p-7 pt-18">
			<div
				className="overflow-scroll h-full rounded-b-[2.4rem]"
				ref={scrollableRef}
				style={{
					backgroundColor:
						state.type === idle.type
							? "white"
							: "var(--color-evy-editor-hover)",
				}}
			>
				{rowsData.map((rowData) => (
					<DraggableRowContainer
						key={rowData.rowId}
						rowId={rowData.rowId}
						selectRow={() => {
							dispatchActiveRow({
								type: "ACTIVATE_ROW",
								pageId: pageId,
								rowId: rowData.rowId,
							});
						}}
					>
						{rowData.row}
					</DraggableRowContainer>
				))}
			</div>
		</div>
	);
}
