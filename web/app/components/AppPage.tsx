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
	const { flows, activeFlowId, dispatchRow, dispatchDragging } =
		useContext(AppContext);

	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idle);

	const rowsData = flows
		.find((f) => f.id === activeFlowId)
		?.pages.find((p) => p.pageId === pageId)?.rowsData;
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
			dispatchRow({
				type: "SET_ACTIVE_ROW",
				pageId: pageId,
				rowId: rowId,
			}),
		[pageId, dispatchRow]
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
		<div className="evy-overflow-hidden evy-p-30px evy-pt-16 evy-h-full evy-w-full evy-box-sizing-border">
			<div
				className="evy-overflow-scroll evy-h-full evy-rounded-b-24"
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
