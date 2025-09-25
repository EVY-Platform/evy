import {
	useEffect,
	useContext,
	useRef,
	useState,
	useCallback,
	useMemo,
} from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { DraggableRowContainer } from "./DraggableRowContainer";
import { AppContext } from "../registry";

type State = { type: "idle" } | { type: "is-row-over" };

const idle: State = { type: "idle" };
const isRowOver: State = { type: "is-row-over" };

// AppPage component for rendering individual pages
export default function AppPage({ pageId }: { pageId: string }) {
	const { pages, dispatchActiveRow, dispatchDragging } =
		useContext(AppContext);

	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idle);

	const rowsData = pages.find((p) => p.pageId === pageId)?.rowsData;
	if (!rowsData) return undefined;

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
					dispatchDragging({ type: "SET_DRAGGING", dragging: true });
				},
				onDrop: () => {
					setState(idle);
					dispatchDragging({ type: "SET_DRAGGING", dragging: false });
				},
			}),
			autoScrollForElements({
				element: scrollableRef.current,
				canScroll: () => true,
			})
		);
	}, [scrollableRef, pageId, dispatchDragging]);

	const selectRow = useCallback(
		(rowId: string) =>
			dispatchActiveRow({
				type: "ACTIVATE_ROW",
				pageId: pageId,
				rowId: rowId,
			}),
		[pageId, dispatchActiveRow]
	);

	const rows = useMemo(
		() =>
			rowsData.map((rowData) => (
				<DraggableRowContainer
					key={rowData.rowId}
					rowId={rowData.rowId}
					selectRow={() => selectRow(rowData.rowId)}
				>
					{rowData.row}
				</DraggableRowContainer>
			)),
		[rowsData]
	);

	return (
		<div className="overflow-hidden p-[30px] pt-16 h-full w-full">
			<div
				className="overflow-scroll h-full rounded-b-[2.4rem]"
				ref={scrollableRef}
				style={{
					backgroundColor:
						state.type === idle.type
							? "white"
							: "var(--color-evy-gray-light)",
				}}
			>
				{rows}
			</div>
		</div>
	);
}
