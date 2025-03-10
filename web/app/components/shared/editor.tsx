"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import invariant from "tiny-invariant";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";

import { EditorContext, type EditorContextValue } from "./editor-context.tsx";
import { Page } from "./page.tsx";
import { getBasePages, type PagesData } from "./registry.tsx";
import { RowType } from "./row.tsx";
import createRegistry from "./registry.tsx";
import { Sidebar } from "./sidebar.tsx";

const panelWidth = "280px";

export default function Editor() {
	const [instanceId] = useState(() => Symbol("instance-id"));
	const [registry] = useState(createRegistry);

	const [data, setData] = useState<PagesData>(() => {
		return getBasePages();
	});

	const stableData = useRef(data);
	useEffect(() => {
		stableData.current = data;
	}, [data]);

	const getPages = useCallback(() => {
		const { pagesData, pagesOrder } = stableData.current;
		return pagesOrder.map((pageId) => pagesData[pageId]);
	}, []);

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
					list: sourcePage.items,
					startIndex,
					finishIndex,
				});

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							items: updatedItems,
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
			itemIndexInStartPage,
			itemIndexInFinishPage,
		}: {
			startPageId: string;
			finishPageId: string;
			itemIndexInStartPage: number;
			itemIndexInFinishPage?: number;
		}) => {
			setData((data) => {
				const sourcePage = data.pagesData[startPageId];
				const destinationPage = data.pagesData[finishPageId];
				const item: RowType = sourcePage.items[itemIndexInStartPage];

				const destinationItems = Array.from(destinationPage.items);
				const newIndexInDestination =
					itemIndexInFinishPage ?? destinationItems.length;
				destinationItems.splice(newIndexInDestination, 0, item);

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[startPageId]: {
							...sourcePage,
							items: (sourcePage?.items || data.rows).filter(
								(i) => i.rowId !== item.rowId
							),
						},
						[finishPageId]: {
							...destinationPage,
							items: destinationItems,
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
				const item: RowType = sourcePage.items[index];

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							items: sourcePage.items.filter(
								(i) => i.rowId !== item.rowId
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
			itemIndexAtStartPage,
			itemIndexInFinishPage,
		}: {
			pageId: string;
			itemIndexAtStartPage: number;
			itemIndexInFinishPage: number;
		}) => {
			setData((data) => {
				const sourcePage = data.pagesData[pageId];
				const item: RowType = data.rows[itemIndexAtStartPage];

				const updatedItems = [
					...sourcePage.items.slice(0, itemIndexInFinishPage),
					item,
					...sourcePage.items.slice(itemIndexInFinishPage),
				];

				return {
					...data,
					pagesData: {
						...data.pagesData,
						[pageId]: {
							...sourcePage,
							items: updatedItems,
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

				const itemId = source.data.itemId;
				invariant(typeof itemId === "string");

				const [, startPageRecord] = location.initial.dropTargets;
				const sourceId = startPageRecord.data.pageId;
				invariant(typeof sourceId === "string");

				const sourcePage = data.pagesData[sourceId];
				const itemIndex = (sourcePage?.items || data.rows).findIndex(
					(item) => item.rowId === itemId
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
					  destinationPage?.items.findIndex(
							(item) =>
								item.rowId === destinationRowRecord.data.itemId
					  )
					: // Otherwise fallback to end of the list
					  destinationPage?.items.length + 1;

				const closestEdgeOfTarget: Edge | null = destinationRowRecord
					? extractClosestEdge(destinationRowRecord.data)
					: null;

				if (destinationPageId === "rows") {
					if (sourceId === destinationPageId) return;
					removeRow({
						pageId: sourcePage.pageId,
						index: itemIndex,
					});
				} else if (sourceId === "rows") {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;
					addRow({
						pageId: destinationPage.pageId,
						itemIndexAtStartPage: itemIndex,
						itemIndexInFinishPage: destinationIndex,
					});
				} else if (sourceId === destinationPageId) {
					const destinationIndex = getReorderDestinationIndex({
						startIndex: itemIndex,
						indexOfTarget,
						closestEdgeOfTarget,
						axis: "vertical",
					});
					reorderRow({
						pageId: sourcePage.pageId,
						startIndex: itemIndex,
						finishIndex: destinationIndex,
					});
				} else {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;

					moveRow({
						itemIndexInStartPage: itemIndex,
						startPageId: sourcePage.pageId,
						finishPageId: destinationPage.pageId,
						itemIndexInFinishPage: destinationIndex,
					});
				}
			},
		});
	}, [data, moveRow, reorderRow]);

	const contextValue: EditorContextValue = useMemo(() => {
		return {
			getPages,
			reorderRow,
			moveRow,
			removeRow,
			addRow,
			registerRow: registry.registerRow,
			instanceId,
		};
	}, [
		getPages,
		reorderRow,
		registry,
		moveRow,
		removeRow,
		addRow,
		instanceId,
	]);

	return (
		<EditorContext.Provider value={contextValue}>
			<div
				className="border-r overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<div className="p-4 text-xl font-bold text-center">Rows</div>
				<Sidebar
					page={{
						pageId: "rows",
						items: data.rows,
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
		</EditorContext.Provider>
	);
}
