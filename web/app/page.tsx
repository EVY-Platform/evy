"use client";

import {
	useEffect,
	useContext,
	useRef,
	useState,
	useCallback,
	useMemo,
} from "react";
import invariant from "tiny-invariant";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { DraggableRowContainer } from "./components/DraggableRowContainer.tsx";
import { ConfigurationPanel } from "./components/ConfigurationPanel.tsx";
import { RowsPanel } from "./components/RowsPanel.tsx";

import { AppProvider, AppContext } from "./registry.tsx";

const panelWidth = "280px";

type State = { type: "idle" } | { type: "is-row-over" };

const idle: State = { type: "idle" };
const isRowOver: State = { type: "is-row-over" };

export default function Index() {
	return (
		<AppProvider>
			<AppContent />
		</AppProvider>
	);
}

function PageContent({ pageId }: { pageId: string }) {
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
	}, [pageId, dispatchActiveRow, dispatchDragging, rowsData]);

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
				{rows}
			</div>
		</div>
	);
}

function AppContent() {
	const { pages, dispatchPages, dispatchActiveRow } = useContext(AppContext);

	useEffect(() => {
		return monitorForElements({
			onDrop(args) {
				const { location, source } = args;
				if (!location.current.dropTargets.length) {
					return;
				}

				const rowId = source.data.rowId;
				invariant(typeof rowId === "string");

				const [, startPageRecord] = location.initial.dropTargets;
				const sourcePageId = startPageRecord.data.pageId;
				invariant(typeof sourcePageId === "string");

				const sourcePageIndex = pages.findIndex(
					(page) => page.pageId === sourcePageId
				);
				const rowIndex = pages[sourcePageIndex]?.rowsData.findIndex(
					(rowData) => rowData.rowId === rowId
				);

				// If the row was dropped on top of another row,
				// dropTargets is an array with [row, page]
				// Otherwise it is [page]
				// Therefore we extract the destinationPageRecord no matter what
				const [destinationRowRecord, destinationPageRecord] =
					location.current.dropTargets.length > 1
						? location.current.dropTargets
						: [null, ...location.current.dropTargets];
				invariant(destinationPageRecord);

				const destinationPageId = destinationPageRecord.data
					.pageId as string;
				const destinationPageIndex = pages.findIndex(
					(page) => page.pageId === destinationPageId
				);

				const indexOfTarget = destinationRowRecord
					? // If the row was dropped on another row, find it's index
					  pages[destinationPageIndex]?.rowsData.findIndex(
							(rowData) =>
								rowData.rowId ===
								destinationRowRecord.data.rowId
					  )
					: // Otherwise fallback to end of the list
					  pages[destinationPageIndex]?.rowsData.length + 1;

				const closestEdgeOfTarget: Edge | null = destinationRowRecord
					? extractClosestEdge(destinationRowRecord.data)
					: null;

				if (destinationPageId === "rows") {
					if (sourcePageId === destinationPageId) return;
					dispatchPages({
						type: "REMOVE_ROW_FROM_PAGE",
						pageId: sourcePageId,
						rowIndex,
					});
				} else if (sourcePageId === "rows") {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;
					const newRowId = crypto.randomUUID();
					dispatchPages({
						type: "ADD_ROW_TO_PAGE",
						pageId: destinationPageId,
						rowId: newRowId,
						rowIdInBase: rowId,
						rowIndexInFinishPage: destinationIndex,
					});
					dispatchActiveRow({
						type: "ACTIVATE_ROW",
						pageId: destinationPageId,
						rowId: newRowId,
					});
				} else if (sourcePageId === destinationPageId) {
					const destinationIndex = getReorderDestinationIndex({
						startIndex: rowIndex,
						indexOfTarget,
						closestEdgeOfTarget,
						axis: "vertical",
					});
					dispatchPages({
						type: "MOVE_ROW_ON_PAGE",
						startPageId: sourcePageId,
						finishPageId: sourcePageId,
						rowIndexInStartPage: rowIndex,
						rowIndexInFinishPage: destinationIndex,
					});
					dispatchActiveRow({
						type: "ACTIVATE_ROW",
						pageId: sourcePageId,
						rowId: rowId,
					});
				} else {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;

					dispatchPages({
						type: "MOVE_ROW_TO_PAGE",
						startPageId: sourcePageId,
						finishPageId: destinationPageId,
						rowIndexInStartPage: rowIndex,
						rowIndexInFinishPage: destinationIndex,
					});
					dispatchActiveRow({
						type: "ACTIVATE_ROW",
						pageId: destinationPageId,
						rowId: rowId,
					});
				}
			},
		});
	}, [pages, dispatchPages, dispatchActiveRow]);

	return (
		<>
			<div
				className="border-r overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<RowsPanel key="rows" />
			</div>
			<div className="flex flex-1 overflow-y-auto flex-row gap-2">
				{pages.map((page) => {
					return (
						<div
							key={page.pageId}
							className="bg-[url('/phone.svg')] bg-no-repeat bg-contain w-84 h-205"
						>
							<PageContent pageId={page.pageId} />
						</div>
					);
				})}
			</div>
			<div
				className="border-l overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<ConfigurationPanel key="configuration" />
			</div>
		</>
	);
}
