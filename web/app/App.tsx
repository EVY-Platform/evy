import { useContext, useEffect, useMemo } from "react";

import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";

import AppPage from "./components/AppPage";
import { ConfigurationPanel } from "./components/ConfigurationPanel";
import { FlowSelector } from "./components/FlowSelector";
import { RowsPanel } from "./components/RowsPanel";
import { AppContext, AppProvider } from "./state";
import { handleDrop } from "./utils/dropHandler";
import { useFlows } from "./hooks/useFlows";

function AppContent() {
	const { flows, activeFlowId, dispatchRow, dispatchDragging } =
		useContext(AppContext);

	const pages = useMemo(
		() => flows.find((flow) => flow.id === activeFlowId)?.pages || [],
		[flows, activeFlowId],
	);

	useEffect(() => {
		return monitorForElements({
			onDrop(args: BaseEventPayload<ElementDragType>) {
				handleDrop(args, pages, dispatchRow, dispatchDragging);
			},
		});
	}, [pages, dispatchRow, dispatchDragging]);

	return (
		<>
			<div className="evy-w-300 evy-flex-shrink-0 evy-border-r evy-border-gray evy-bg-white evy-shadow-subtle">
				<RowsPanel />
			</div>
			<div className="evy-flex-1 evy-overflow-auto evy-flex evy-flex-row evy-gap-4 evy-p-4">
				{pages.map((page) => {
					return (
						<div
							key={page.id}
							className="evy-flex-shrink-0 evy-mx-auto evy-bg-phone evy-bg-no-repeat evy-bg-contain evy-w-336 evy-h-662"
						>
							<AppPage pageId={page.id} />
						</div>
					);
				})}
			</div>
			<div className="evy-w-300 evy-flex-shrink-0 evy-border-l evy-border-gray evy-overflow-y-auto evy-bg-white evy-shadow-subtle">
				<ConfigurationPanel />
			</div>
		</>
	);
}

export function App() {
	const { flows, loading } = useFlows();
	const usingInjectedTestFlows = Boolean(win?.__TEST_FLOWS__);

	// Use test flows if available (for testing), otherwise use fetched flows
	const initialFlows = window.__TEST_FLOWS__ ?? flows;

	if (loading && !usingInjectedTestFlows) {
		return (
			<div className="evy-h-screen evy-flex evy-items-center evy-justify-center evy-bg-gray-light">
				<div className="evy-text-gray-dark evy-text-lg">Loading flows...</div>
			</div>
		);
	}

	if (!initialFlows) {
		return (
			<div className="evy-h-screen evy-flex evy-items-center evy-justify-center evy-bg-gray-light">
				<div className="evy-text-red-500 evy-text-lg">Failed to load flows</div>
			</div>
		);
	}

	return (
		<AppProvider
			initialFlows={initialFlows}
			syncWithApi={!usingInjectedTestFlows}
		>
			<div className="evy-h-screen evy-overflow-hidden evy-flex evy-flex-col">
				<div className="evy-border-b evy-border-gray evy-p-2 evy-bg-white evy-flex evy-justify-between evy-items-center">
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
