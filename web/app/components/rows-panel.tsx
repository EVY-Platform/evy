import { memo, useEffect, useRef } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { Row, type RowData } from "./row.tsx";
import { CancelOverlay } from "./cancel-overlay.tsx";

export const RowsPanel = memo(function RowsPanel({
	rowsData,
	dragging,
	onDrag,
	dismiss,
}: {
	rowsData: RowData[];
	dragging: boolean;
	onDrag: (dragging: boolean) => void;
	dismiss: () => void;
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
					{rowsData.map((rowData) => (
						<Row key={rowData.rowId} rowId={rowData.rowId}>
							{rowData.row}
						</Row>
					))}
				</div>
				{dragging && <CancelOverlay dismiss={dismiss} />}
			</div>
		</div>
	);
});
