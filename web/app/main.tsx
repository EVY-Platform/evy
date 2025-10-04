import { createRoot } from "react-dom/client";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useContext, useEffect } from "react";
import invariant from "tiny-invariant";

import { AppProvider, AppContext } from "./registry.tsx";
import { ConfigurationPanel } from "./components/ConfigurationPanel.tsx";
import { RowsPanel } from "./components/RowsPanel.tsx";
import { FlowSelector } from "./components/FlowSelector.tsx";
import AppPage from "./components/AppPage.tsx";
import type { Edge } from "./components/DraggableRowContainer.tsx";

const panelWidth = "280px";

function AppContent() {
	const { flows, activeFlowId, dispatchRow } = useContext(AppContext);

	const pages = flows.find((flow) => flow.id === activeFlowId)?.pages || [];

	useEffect(() => {
		return monitorForElements({
			onDrop(args: any) {
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
					dispatchRow({
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
					dispatchRow({
						type: "ADD_ROW_TO_PAGE",
						pageId: destinationPageId,
						rowId: newRowId,
						rowIdInBase: rowId,
						rowIndexInFinishPage: destinationIndex,
					});
				} else if (sourcePageId === destinationPageId) {
					const destinationIndex = getReorderDestinationIndex({
						startIndex: rowIndex,
						indexOfTarget,
						closestEdgeOfTarget,
						axis: "vertical",
					});
					dispatchRow({
						type: "MOVE_ROW_ON_PAGE",
						startPageId: sourcePageId,
						finishPageId: sourcePageId,
						rowIndexInStartPage: rowIndex,
						rowIndexInFinishPage: destinationIndex,
					});
				} else {
					const destinationIndex =
						closestEdgeOfTarget === "bottom"
							? indexOfTarget + 1
							: indexOfTarget;

					dispatchRow({
						type: "MOVE_ROW_TO_PAGE",
						startPageId: sourcePageId,
						finishPageId: destinationPageId,
						rowIndexInStartPage: rowIndex,
						rowIndexInFinishPage: destinationIndex,
					});
				}
			},
		});
	}, [pages, dispatchRow]);

	return (
		<>
			<div
				className="evy-border-r evy-border-gray evy-overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<RowsPanel key="rows" />
			</div>
			<div className="evy-flex evy-flex-1 evy-overflow-y-auto evy-flex-row evy-gap-2 evy-justify-center">
				{pages.map((page) => {
					return (
						<div
							key={page.pageId}
							className="evy-bg-phone evy-bg-no-repeat evy-bg-contain evy-w-336 evy-h-662"
						>
							<AppPage pageId={page.pageId} />
						</div>
					);
				})}
			</div>
			<div
				className="evy-border-l evy-border-gray evy-overflow-y-auto"
				style={{ width: panelWidth }}
			>
				<ConfigurationPanel key="configuration" />
			</div>
		</>
	);
}

function App() {
	return (
		<AppProvider>
			<div className="evy-h-screen evy-flex evy-flex-col evy-overflow-hidden">
				<div className="evy-border-b evy-border-gray evy-p-4 evy-line-height-1 evy-flex evy-justify-between evy-items-center">
					<a href="/">
						<img className="evy-h-4" src="/logo.svg" alt="EVY" />
					</a>
					<FlowSelector />
				</div>
				<div className="evy-flex evy-flex-1 evy-overflow-hidden">
					<AppContent />
				</div>
			</div>
		</AppProvider>
	);
}

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
