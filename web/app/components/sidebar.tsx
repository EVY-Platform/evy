import { memo, useEffect, useRef, useState } from "react";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Flex, Stack, xcss } from "@atlaskit/primitives";
import invariant from "tiny-invariant";

import { Row, type RowData } from "./row.tsx";

const sidebarStyles = xcss({
	width: "100%",
	backgroundColor: "elevation.surface.sunken",
});

const rowListStyles = xcss({
	boxSizing: "border-box",
	minHeight: "100%",
	padding: "space.100",
	gap: "space.100",
});

type State = { type: "idle" } | { type: "is-row-over" };

// preventing re-renders with stable state objects
const idle: State = { type: "idle" };
const isRowOver: State = { type: "is-row-over" };

const stateStyles: {
	[key in State["type"]]: ReturnType<typeof xcss> | undefined;
} = {
	idle: xcss({}),
	"is-row-over": xcss({
		backgroundColor: "color.background.selected.hovered",
	}),
};

export const Sidebar = memo(function Sidebar({
	rowsData,
}: {
	rowsData: RowData[];
}) {
	const pageInnerRef = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idle);

	useEffect(() => {
		invariant(pageInnerRef.current);
		return combine(
			dropTargetForElements({
				element: pageInnerRef.current,
				getData: () => ({ pageId: "rows" }),
				canDrop: () => true,
				onDragEnter: () => setState(isRowOver),
				onDragLeave: () => setState(idle),
				onDragStart: () => setState(isRowOver),
				onDrop: () => setState(idle),
			})
		);
	}, []);

	return (
		<Flex xcss={[sidebarStyles, stateStyles[state.type]]}>
			<Stack ref={pageInnerRef}>
				<Stack xcss={rowListStyles} space="space.100">
					{rowsData.map((rowData) => (
						<Row key={rowData.rowId} rowId={rowData.rowId}>
							{rowData.row}
						</Row>
					))}
				</Stack>
			</Stack>
		</Flex>
	);
});
