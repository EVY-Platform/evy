import { memo, useEffect, useRef, useState } from "react";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { Box, Flex, Stack, xcss } from "@atlaskit/primitives";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { Row, type RowType } from "./row.tsx";

const pageStyles = xcss({
	width: "250px",
	backgroundColor: "elevation.surface.sunken",
});

const scrollContainerStyles = xcss({
	height: "480px",
	overflowY: "auto",
});

const rowListStyles = xcss({
	boxSizing: "border-box",
	minHeight: "100%",
});

type PageData = {
	pageId: string;
	rows: RowType[];
};
export type PagesData = {
	rows: RowType[];
	pagesData: { [pageId: string]: PageData };
	pagesOrder: string[];
};

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

export const Page = memo(function Page({ page }: { page: PageData }) {
	const pageId = page.pageId;
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
				onDragStart: () => setState(isRowOver),
				onDrop: () => setState(idle),
			}),
			autoScrollForElements({
				element: scrollableRef.current,
				canScroll: () => true,
			})
		);
	}, [pageId]);

	return (
		<Flex direction="column" xcss={[pageStyles, stateStyles[state.type]]}>
			<Box xcss={scrollContainerStyles} ref={scrollableRef}>
				<Stack xcss={rowListStyles}>
					{page.rows.map((row) => (
						<Row row={row} key={row.rowId} />
					))}
				</Stack>
			</Box>
		</Flex>
	);
});
