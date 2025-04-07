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
	const baseRows = getBaseRows();

	const [pages, setPages] = useState(getPages());
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
			const pageIndex = pages.findIndex((page) => page.pageId === pageId);
			pages[pageIndex].rowsData = reorder({
				list: pages[pageIndex].rowsData,
				startIndex,
				finishIndex,
			});

			setPages(pages);
		},
		[pages]
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
			const sourcePageIndex = pages.findIndex(
				(page) => page.pageId === startPageId
			);
			const destinationPageIndex = pages.findIndex(
				(page) => page.pageId === finishPageId
			);
			const rowData: RowData =
				pages[sourcePageIndex].rowsData[rowIndexInStartPage];

			const destinationItems = Array.from(
				pages[destinationPageIndex].rowsData
			);
			const newIndexInDestination =
				rowIndexInFinishPage ?? destinationItems.length;
			destinationItems.splice(newIndexInDestination, 0, rowData);

			pages[sourcePageIndex].rowsData = pages[
				sourcePageIndex
			].rowsData.filter((_, idx) => idx !== rowIndexInStartPage);
			pages[destinationPageIndex].rowsData = destinationItems;

			setActiveConfiguration(rowData.config);
			setPages(pages);
		},
		[pages]
	);

	const removeRow = useCallback(
		({ pageId, index }: { pageId: string; index: number }) => {
			const pageIndex = pages.findIndex((page) => page.pageId === pageId);
			pages[pageIndex].rowsData = pages[pageIndex].rowsData.filter(
				(_, idx) => idx !== index
			);
			setPages(pages);
		},
		[pages]
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
			const sourcePageIndex = pages.findIndex(
				(page) => page.pageId === pageId
			);
			const rowData: RowData = {
				...baseRows[rowIndexAtStartPage],
				rowId: crypto.randomUUID(),
				config: baseRows[rowIndexAtStartPage].config,
			};

			pages[sourcePageIndex].rowsData = [
				...pages[sourcePageIndex].rowsData.slice(
					0,
					rowIndexInFinishPage
				),
				rowData,
				...pages[sourcePageIndex].rowsData.slice(rowIndexInFinishPage),
			];

			setActiveConfiguration(rowData.config);
			setPages(pages);
		},
		[pages]
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
				const sourcePageId = startPageRecord.data.pageId;
				invariant(typeof sourcePageId === "string");

				const sourcePageIndex = pages.findIndex(
					(page) => page.pageId === sourcePageId
				);
				const rowIndex = (
					pages[sourcePageIndex]?.rowsData || baseRows
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
					removeRow({
						pageId: sourcePageId,
						index: rowIndex,
					});
				} else if (sourcePageId === "rows") {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;
					addRow({
						pageId: destinationPageId,
						rowIndexAtStartPage: rowIndex,
						rowIndexInFinishPage: destinationIndex,
					});
				} else if (sourcePageId === destinationPageId) {
					const destinationIndex = getReorderDestinationIndex({
						startIndex: rowIndex,
						indexOfTarget,
						closestEdgeOfTarget,
						axis: "vertical",
					});
					reorderRow({
						pageId: sourcePageId,
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
						startPageId: sourcePageId,
						finishPageId: pages[destinationPageIndex].pageId,
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
				{pages.map((page) => {
					return (
						<div
							key={page.pageId}
							className="bg-[url('/phone.svg')] bg-no-repeat bg-contain w-84 h-205"
						>
							<Page
								pageId={page.pageId}
								rowsData={page.rowsData}
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
