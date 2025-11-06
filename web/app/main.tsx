import { createRoot } from "react-dom/client";
import { useContext, useEffect, useMemo } from "react";
import invariant from "tiny-invariant";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { AppProvider, AppContext, type ServerFlow } from "./registry.tsx";
import { ConfigurationPanel } from "./components/ConfigurationPanel.tsx";
import { RowsPanel } from "./components/RowsPanel.tsx";
import { FlowSelector } from "./components/FlowSelector.tsx";
import AppPage from "./components/AppPage.tsx";
import type { Edge } from "./components/DraggableRowContainer.tsx";
import { EVYRow } from "./rows/EVYRow.tsx";

interface DropLocation {
	current: {
		dropTargets: Array<{
			data: {
				pageId: string;
				rowId: string;
			};
		}>;
	};
	initial: {
		dropTargets: Array<{
			data: {
				pageId: string;
			};
		}>;
	};
}

interface DropSource {
	data: {
		rowId: string;
	};
}

interface DropEvent {
	location: DropLocation;
	source: DropSource;
}

const panelWidth = "300px";

function AppContent() {
	const { flows, activeFlowId, dispatchRow } = useContext(AppContext);

	const pages = useMemo(
		() => flows.find((flow) => flow.id === activeFlowId)?.pages || [],
		[flows, activeFlowId]
	);

	useEffect(() => {
		return monitorForElements({
			onDrop(args: DropEvent) {
				const { location, source } = args;
				if (!location.current.dropTargets.length) {
					return;
				}

				const rowId = source.data.rowId;
				invariant(
					typeof rowId === "string",
					"AppContent monitor for elements onDrop: rowId is not a string"
				);

				const sourcePageId =
					location.initial.dropTargets[
						location.initial.dropTargets.length - 1
					].data.pageId;
				invariant(
					typeof sourcePageId === "string",
					"AppContent monitor for elements onDrop: sourcePageId is not a string"
				);

				// If the row was dropped on top of another row,
				// dropTargets is an array with [row, ..., page]
				// Otherwise it is [page]
				const destinationPageRecord =
					location.current.dropTargets[
						location.current.dropTargets.length - 1
					];
				invariant(
					destinationPageRecord,
					"AppContent monitor for elements onDrop: destinationPageRecord is not defined"
				);

				const destinationPageId = destinationPageRecord.data
					.pageId as string;
				if (destinationPageId === "rows" && sourcePageId === "rows") {
					return;
				}

				if (destinationPageId === "rows") {
					dispatchRow({
						type: "REMOVE_ROW",
						pageId: sourcePageId,
						rowId,
					});
					return;
				}

				const destinationPage = pages.find(
					(page) => page.id === destinationPageId
				);
				invariant(
					destinationPage,
					"AppContent monitor for elements onDrop: destinationPage is not defined"
				);

				// If the row was dropped on top of another row,
				// dropTargets is an array with [row, ..., page]
				// Otherwise it is [page]
				const destinationRow =
					location.current.dropTargets.length > 1
						? location.current.dropTargets[0]
						: null;

				const destinationContainer =
					destinationRow &&
					EVYRow.findContainerOfRow(
						destinationRow.data.rowId,
						destinationPage.rows
					);

				const closestEdgeOfTarget: Edge | null = destinationRow
					? extractClosestEdge(destinationRow.data)
					: null;

				let indexOfTarget = 0;
				if (destinationRow) {
					if (
						destinationContainer?.type === "children" &&
						destinationContainer.container.config.view.content
							.children
					) {
						indexOfTarget =
							destinationContainer.container.config.view.content.children.findIndex(
								(r) => r.rowId === destinationRow.data.rowId
							);
					} else if (
						destinationContainer?.type === "child" &&
						destinationContainer.container.config.view.content.child
					) {
						indexOfTarget = 0;
					} else if (closestEdgeOfTarget && !destinationContainer) {
						const destinationRowIndex =
							destinationPage.rows.findIndex(
								(r) => r.rowId === destinationRow.data.rowId
							);
						indexOfTarget =
							closestEdgeOfTarget === "top" ||
							closestEdgeOfTarget === "left"
								? destinationRowIndex
								: destinationRowIndex + 1;
					}
				}

				if (
					closestEdgeOfTarget === "top" ||
					closestEdgeOfTarget === "left"
				) {
					indexOfTarget = indexOfTarget ?? 0;
				} else if (
					closestEdgeOfTarget === "bottom" ||
					closestEdgeOfTarget === "right"
				) {
					indexOfTarget = indexOfTarget + 1;
				} else {
					indexOfTarget =
						indexOfTarget ?? destinationPage.rows.length;
				}

				const baseOptions = {
					destinationPageId: destinationPageId,
					destinationIndex: indexOfTarget,
					destinationContainer: destinationContainer
						? {
								rowId: destinationContainer.container.rowId,
								type: destinationContainer.type,
						  }
						: undefined,
				};

				if (sourcePageId === "rows") {
					dispatchRow({
						type: "ADD_ROW",
						newRowId: crypto.randomUUID(),
						oldRowId: rowId,
						...baseOptions,
					});
				} else if (sourcePageId === destinationPageId) {
					dispatchRow({
						type: "MOVE_ROW",
						rowId,
						originPageId: sourcePageId,
						...baseOptions,
					});
				} else if (destinationPageId !== sourcePageId) {
					dispatchRow({
						type: "MOVE_ROW",
						rowId,
						originPageId: sourcePageId,
						...baseOptions,
					});
				}
			},
		});
	}, [pages, dispatchRow]);

	return (
		<>
			<div
				className="evy-border-r evy-border-gray evy-overflow-y-auto evy-bg-white evy-shadow-subtle"
				style={{ width: panelWidth }}
			>
				<RowsPanel key="rows" />
			</div>
			<div className="evy-flex evy-flex-1 evy-overflow-y-auto evy-flex-row evy-gap-4 evy-justify-center">
				{pages.map((page) => {
					return (
						<div
							key={page.id}
							className="evy-bg-phone evy-bg-no-repeat evy-bg-contain evy-w-336 evy-h-662"
						>
							<AppPage pageId={page.id} />
						</div>
					);
				})}
			</div>
			<div
				className="evy-border-l evy-border-gray evy-overflow-y-auto evy-bg-white evy-shadow-subtle"
				style={{ width: panelWidth }}
			>
				<ConfigurationPanel key="configuration" />
			</div>
		</>
	);
}

function App() {
	const win = window as { __TEST_FLOWS__?: ServerFlow[] };

	return (
		<AppProvider initialFlows={win?.__TEST_FLOWS__}>
			<div className="evy-h-screen evy-overflow-hidden">
				<div className="evy-border-b evy-border-gray evy-p-4 evy-bg-white evy-flex evy-justify-between evy-items-center">
					<a href="/">
						<img className="evy-h-4" src="/logo.svg" alt="EVY" />
					</a>
					<FlowSelector />
				</div>
				<div className="evy-flex evy-flex-1 evy-overflow-hidden evy-bg-gray-light">
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
