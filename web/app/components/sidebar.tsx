import { memo, useEffect, useRef } from "react";

import { Box, Flex, Stack, xcss } from "@atlaskit/primitives";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { Row, type RowData } from "./row.tsx";
import { CancelOverlay } from "./cancel-overlay.tsx";

const sidebarStyles = xcss({
	position: "relative",
	width: "100%",
	backgroundColor: "elevation.surface.sunken",
});

const rowListStyles = xcss({
	boxSizing: "border-box",
	minHeight: "100%",
	padding: "space.100",
	gap: "space.100",
});

const overlayStyles = xcss({
	position: "absolute",
	width: "100%",
	height: "100%",
});

export const Sidebar = memo(function Sidebar({
	rowsData,
	dragging,
	onDrag,
}: {
	rowsData: RowData[];
	dragging: boolean;
	onDrag: (dragging: boolean) => void;
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
		<Flex xcss={sidebarStyles}>
			<Stack ref={pageInnerRef}>
				<div className="p-4 text-xl font-bold text-center">Rows</div>
				<Stack xcss={rowListStyles} space="space.100">
					{rowsData.map((rowData) => (
						<Row key={rowData.rowId} rowId={rowData.rowId}>
							{rowData.row}
						</Row>
					))}
				</Stack>
				{dragging && (
					<Box xcss={overlayStyles}>
						<CancelOverlay />
					</Box>
				)}
			</Stack>
		</Flex>
	);
});
