"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import invariant from "tiny-invariant";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";

import { Page } from "./components/shared/page.tsx";
import { type PagesData } from "./components/shared/page.tsx";
import { RowType } from "./components/shared/row.tsx";
import { Sidebar } from "./components/shared/sidebar.tsx";

import sampleData from "./sample_data.json";

const panelWidth = "280px";

export default function Index() {
	const [data, setData] = useState<PagesData>(() => {
		return sampleData;
	});

	const stableData = useRef(data);
	useEffect(() => {
		stableData.current = data;
	}, [data]);

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
					list: sourcePage.rows,
					startIndex,
					finishIndex,
				});

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							rows: updatedItems,
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
				const row: RowType = sourcePage.rows[rowIndexInStartPage];

				const destinationItems = Array.from(destinationPage.rows);
				const newIndexInDestination =
					rowIndexInFinishPage ?? destinationItems.length;
				destinationItems.splice(newIndexInDestination, 0, row);

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[startPageId]: {
							...sourcePage,
							rows: (sourcePage?.rows || data.rows).filter(
								(i) => i.rowId !== row.rowId
							),
						},
						[finishPageId]: {
							...destinationPage,
							rows: destinationItems,
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
				const row: RowType = sourcePage.rows[index];

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							rows: sourcePage.rows.filter(
								(i) => i.rowId !== row.rowId
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
				const row: RowType = {
					...data.rows[rowIndexAtStartPage],
					rowId: crypto.randomUUID(),
				};

				const updatedItems = [
					...sourcePage.rows.slice(0, rowIndexInFinishPage),
					row,
					...sourcePage.rows.slice(rowIndexInFinishPage),
				];

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							rows: updatedItems,
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
				const rowIndex = (sourcePage?.rows || data.rows).findIndex(
					(row) => row.rowId === rowId
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
				const destinationPage = data.pagesData[destinationPageId];

				const indexOfTarget = destinationRowRecord
					? // If the row was dropped on another row, find it's index
					  destinationPage?.rows.findIndex(
							(row) =>
								row.rowId === destinationRowRecord.data.rowId
					  )
					: // Otherwise fallback to end of the list
					  destinationPage?.rows.length + 1;

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
				<div className="p-4 text-xl font-bold text-center">Rows</div>
				<Sidebar
					page={{
						pageId: "rows",
						rows: data.rows,
					}}
					key="rows"
				/>
			</div>
			<div className="flex flex-1 overflow-y-auto flex-row gap-2">
				{data.pagesOrder.map((pageId) => {
					return (
						<div key={pageId}>
							<div className="p-4 text-xl font-bold text-center capitalize">
								{pageId}
							</div>
							<Page page={data.pagesData[pageId]} key={pageId} />
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
