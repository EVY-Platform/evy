"use client";

import { useCallback, useEffect, useState } from "react";

import invariant from "tiny-invariant";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";

import { ConfigurationPanel } from "./components/configuration-panel.tsx";
import { Page } from "./components/page.tsx";
import { RowData, RowConfig } from "./components/row.tsx";
import { RowsPanel } from "./components/rows-panel.tsx";

import { getPages, getBaseRows } from "./registry.tsx";

const panelWidth = "280px";

export default function Index() {
	const [pages, setPages] = useState(getPages);
	const [baseRows, _] = useState(getBaseRows);
	const [dragging, setDragging] = useState<boolean>(false);
	const [activeConfiguration, setActiveConfiguration] = useState<
		RowConfig | undefined
	>();

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
			setPages((pages) => {
				const sourcePage = pages.pagesData[pageId];
				const updatedItems = reorder({
					list: sourcePage.rowsData,
					startIndex,
					finishIndex,
				});

				return {
					...pages,
					pagesData: {
						...pages.pagesData,
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
			setPages((pages) => {
				const sourcePage = pages.pagesData[startPageId];
				const destinationPage = pages.pagesData[finishPageId];
				const rowData: RowData =
					sourcePage.rowsData[rowIndexInStartPage];

				const destinationItems = Array.from(destinationPage.rowsData);
				const newIndexInDestination =
					rowIndexInFinishPage ?? destinationItems.length;
				destinationItems.splice(newIndexInDestination, 0, rowData);

				setActiveConfiguration(rowData.config);

				return {
					...pages,
					pagesData: {
						...pages.pagesData,
						[startPageId]: {
							...sourcePage,
							rowsData: (sourcePage?.rowsData || baseRows).filter(
								(rd) => rd.rowId !== rowData.rowId
							),
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
			setPages((pages) => {
				const sourcePage = pages.pagesData[pageId];
				const rowData: RowData = sourcePage.rowsData[index];

				return {
					...pages,
					pagesData: {
						...pages.pagesData,
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
			setPages((pages) => {
				const sourcePage = pages.pagesData[pageId];
				const rowData: RowData = {
					...baseRows[rowIndexAtStartPage],
					rowId: crypto.randomUUID(),
					config: baseRows[rowIndexAtStartPage].config,
				};

				const updatedItems = [
					...sourcePage.rowsData.slice(0, rowIndexInFinishPage),
					rowData,
					...sourcePage.rowsData.slice(rowIndexInFinishPage),
				];

				setActiveConfiguration(rowData.config);

				return {
					...pages,
					pagesData: {
						...pages.pagesData,
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

				const sourcePage = pages.pagesData[sourceId];
				const rowIndex = (sourcePage?.rowsData || baseRows).findIndex(
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
				const destinationPage = pages.pagesData[destinationPageId];

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
	}, [pages]);

	return (
		<>
			<div
				className="border-r overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<RowsPanel
					key="rows"
					rowsData={baseRows}
					dragging={dragging}
					onDrag={setDragging}
					dismiss={() => setDragging(false)}
				/>
			</div>
			<div className="flex flex-1 overflow-y-auto flex-row gap-2">
				{pages.pagesOrder.map((pageId) => {
					return (
						<div
							key={pageId}
							className="bg-[url('/phone.svg')] bg-no-repeat bg-contain w-84 h-205"
						>
							<Page
								pageId={pageId}
								rowsData={pages.pagesData[pageId].rowsData}
								onDrag={setDragging}
								selectRow={setActiveConfiguration}
							/>
						</div>
					);
				})}
			</div>
			<div
				className="border-l overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<ConfigurationPanel
					key="configuration"
					configuration={activeConfiguration}
				/>
			</div>
		</>
	);
}
