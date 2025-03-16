"use client";

import { useCallback, useEffect, useState } from "react";

import invariant from "tiny-invariant";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";

import { Page } from "./components/page.tsx";
import { RowData } from "./components/row.tsx";
import { Sidebar } from "./components/sidebar.tsx";

import { getBasePages } from "./registry.tsx";

const panelWidth = "280px";

export default function Index() {
	const [data, setData] = useState(getBasePages);
	const [dragging, setDragging] = useState<boolean>(false);

	const reorderRow = useCallback(
		({
			pageId,
			startIndex,
			finishIndex,
		}: {
			pageId: string;
			startIndex: number;
			finishIndex: number;
		}) => {
			setData((data) => {
				const sourcePage = data.pagesData[pageId];
				const updatedItems = reorder({
					list: sourcePage.rowsData,
					startIndex,
					finishIndex,
				});

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							rowsData: updatedItems,
						},
					},
				};
			});
		},
		[]
	);

	const moveRow = useCallback(
		({
			startPageId,
			finishPageId,
			rowIndexInStartPage,
			rowIndexInFinishPage,
		}: {
			startPageId: string;
			finishPageId: string;
			rowIndexInStartPage: number;
			rowIndexInFinishPage?: number;
		}) => {
			setData((data) => {
				const sourcePage = data.pagesData[startPageId];
				const destinationPage = data.pagesData[finishPageId];
				const rowData: RowData =
					sourcePage.rowsData[rowIndexInStartPage];

				const destinationItems = Array.from(destinationPage.rowsData);
				const newIndexInDestination =
					rowIndexInFinishPage ?? destinationItems.length;
				destinationItems.splice(newIndexInDestination, 0, rowData);

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[startPageId]: {
							...sourcePage,
							rowsData: (
								sourcePage?.rowsData || data.rowsData
							).filter((rd) => rd.rowId !== rowData.rowId),
						},
						[finishPageId]: {
							...destinationPage,
							rowsData: destinationItems,
						},
					},
				};
			});
		},
		[]
	);

	const removeRow = useCallback(
		({ pageId, index }: { pageId: string; index: number }) => {
			setData((data) => {
				const sourcePage = data.pagesData[pageId];
				const rowData: RowData = sourcePage.rowsData[index];

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							rowsData: sourcePage.rowsData.filter(
								(rd) => rd.rowId !== rowData.rowId
							),
						},
					},
				};
			});
		},
		[]
	);

	const addRow = useCallback(
		({
			pageId,
			rowIndexAtStartPage,
			rowIndexInFinishPage,
		}: {
			pageId: string;
			rowIndexAtStartPage: number;
			rowIndexInFinishPage: number;
		}) => {
			setData((data) => {
				const sourcePage = data.pagesData[pageId];
				const rowData: RowData = {
					...data.rowsData[rowIndexAtStartPage],
					rowId: crypto.randomUUID(),
				};

				const updatedItems = [
					...sourcePage.rowsData.slice(0, rowIndexInFinishPage),
					rowData,
					...sourcePage.rowsData.slice(rowIndexInFinishPage),
				];

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							rowsData: updatedItems,
						},
					},
				};
			});
		},
		[]
	);

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
				const sourceId = startPageRecord.data.pageId;
				invariant(typeof sourceId === "string");

				const sourcePage = data.pagesData[sourceId];
				const rowIndex = (
					sourcePage?.rowsData || data.rowsData
				).findIndex((rowData) => rowData.rowId === rowId);

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
				const destinationPage = data.pagesData[destinationPageId];

				const indexOfTarget = destinationRowRecord
					? // If the row was dropped on another row, find it's index
					  destinationPage?.rowsData.findIndex(
							(rowData) =>
								rowData.rowId ===
								destinationRowRecord.data.rowId
					  )
					: // Otherwise fallback to end of the list
					  destinationPage?.rowsData.length + 1;

				const closestEdgeOfTarget: Edge | null = destinationRowRecord
					? extractClosestEdge(destinationRowRecord.data)
					: null;

				if (destinationPageId === "rows") {
					if (sourceId === destinationPageId) return;
					removeRow({
						pageId: sourcePage.pageId,
						index: rowIndex,
					});
				} else if (sourceId === "rows") {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;
					addRow({
						pageId: destinationPage.pageId,
						rowIndexAtStartPage: rowIndex,
						rowIndexInFinishPage: destinationIndex,
					});
				} else if (sourceId === destinationPageId) {
					const destinationIndex = getReorderDestinationIndex({
						startIndex: rowIndex,
						indexOfTarget,
						closestEdgeOfTarget,
						axis: "vertical",
					});
					reorderRow({
						pageId: sourcePage.pageId,
						startIndex: rowIndex,
						finishIndex: destinationIndex,
					});
				} else {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;

					moveRow({
						rowIndexInStartPage: rowIndex,
						startPageId: sourcePage.pageId,
						finishPageId: destinationPage.pageId,
						rowIndexInFinishPage: destinationIndex,
					});
				}
			},
		});
	}, [data, moveRow, reorderRow]);

	return (
		<>
			<div
				className="border-r overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<Sidebar
					key="rows"
					rowsData={data.rowsData}
					dragging={dragging}
					onDrag={setDragging}
				/>
			</div>
			<div className="flex flex-1 overflow-y-auto flex-row gap-2">
				{data.pagesOrder.map((pageId) => {
					return (
						<div key={pageId}>
							<div className="p-4 text-xl font-bold text-center capitalize">
								{pageId}
							</div>
							<Page
								pageId={pageId}
								rowsData={data.pagesData[pageId].rowsData}
								onDrag={setDragging}
							/>
						</div>
					);
				})}
			</div>
			<div
				className="border-l overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<div className="p-4 text-xl font-bold text-center">
					Configuration
				</div>
			</div>
		</>
	);
}
