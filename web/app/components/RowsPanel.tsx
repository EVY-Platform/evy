"use client";

import { useEffect, useRef } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { Row, type RowBaseData } from "./Row.tsx";
import { CancelOverlay } from "./CancelOverlay.tsx";

export function RowsPanel({
	rowsData,
	dragging,
	onDrag,
	cancel,
}: {
	rowsData: RowBaseData[];
	dragging: boolean;
	onDrag: (dragging: boolean) => void;
	cancel: () => void;
}) {
	const pageInnerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		invariant(pageInnerRef.current);
		return combine(
			dropTargetForElements({
				element: pageInnerRef.current,
				getData: () => ({ pageId: "rows" }),
				canDrop: () => true,
				onDragStart: () => onDrag(true),
				onDrop: () => onDrag(false),
			})
		);
	}, []);

	return (
		<div className="flex relative w-full bg-evy-light-gray">
			<div className="flex flex-col" ref={pageInnerRef}>
				<div className="p-4 text-xl font-bold text-center">Rows</div>
				<div className="flex flex-col min-h-full p-2 gap-2">
					{rowsData.map((rowData) => {
						const props = Object.fromEntries(
							rowData.config.map((c) => [c.id, c.value])
						);
						return (
							<Row key={rowData.rowId} rowId={rowData.rowId}>
								<rowData.row
									key={rowData.rowId}
									rowId={rowData.rowId}
									{...props}
								/>
							</Row>
						);
					})}
				</div>
				{dragging && <CancelOverlay dismiss={cancel} />}
			</div>
		</div>
	);
}
