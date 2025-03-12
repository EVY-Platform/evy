import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { Box, Flex, Stack, xcss } from "@atlaskit/primitives";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import invariant from "tiny-invariant";

import { PageContext, type PageContextProps } from "./page-context.tsx";
import { Row } from "./row.tsx";
import { RowType } from "./row.tsx";

const pageStyles = xcss({
	width: "250px",
	backgroundColor: "elevation.surface.sunken",
	borderRadius: "border.radius.300",
});

const stackStyles = xcss({
	minHeight: "0", // allow the container to be shrunk by a parent height
	flexGrow: 1,
});

const scrollContainerStyles = xcss({
	height: "480px",
	overflowY: "auto",
});

const rowListStyles = xcss({
	boxSizing: "border-box",
	minHeight: "100%",
	padding: "space.100",
	gap: "space.100",
});

export type PageData = {
	pageId: string;
	items: RowType[];
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
	const pageInnerRef = useRef<HTMLDivElement | null>(null);
	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idle);

	useEffect(() => {
		invariant(pageInnerRef.current);
		invariant(scrollableRef.current);
		return combine(
			dropTargetForElements({
				element: pageInnerRef.current,
				getData: () => ({ pageId }),
				canDrop: ({ source }) => {
					return source.data.type === "row";
				},
				getIsSticky: () => true,
				onDragEnter: () => setState(isRowOver),
				onDragLeave: () => setState(idle),
				onDragStart: () => setState(isRowOver),
				onDrop: () => setState(idle),
			}),
			autoScrollForElements({
				element: scrollableRef.current,
				canScroll: ({ source }) => source.data.type === "row",
			})
		);
	}, [pageId]);

	const stableItems = useRef(page.items);
	useEffect(() => {
		stableItems.current = page.items;
	}, [page.items]);

	const getRowIndex = useCallback((rowId: string) => {
		return stableItems.current.findIndex((item) => item.rowId === rowId);
	}, []);

	const getNumRows = useCallback(() => {
		return stableItems.current.length;
	}, []);

	const contextValue: PageContextProps = useMemo(() => {
		return { pageId, getRowIndex, getNumRows };
	}, [pageId, getRowIndex, getNumRows]);

	return (
		<PageContext.Provider value={contextValue}>
			<Flex
				direction="column"
				xcss={[pageStyles, stateStyles[state.type]]}
			>
				<Stack xcss={stackStyles} ref={pageInnerRef}>
					<Box xcss={scrollContainerStyles} ref={scrollableRef}>
						<Stack xcss={rowListStyles} space="space.100">
							{page.items.map((item) => (
								<Row item={item} key={item.rowId} />
							))}
						</Stack>
					</Box>
				</Stack>
			</Flex>
		</PageContext.Provider>
	);
});
