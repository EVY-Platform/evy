import { useContext, useEffect, useMemo, useRef } from "react";

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
import { useActiveFlow } from "./hooks/useActiveFlow";

function AppContent() {
	const { dispatchRow, dispatchDragging, activePageId, focusMode } =
		useContext(AppContext);
	const { pages } = useActiveFlow();
	const canvasRef = useRef<HTMLDivElement | null>(null);
	const visiblePages = useMemo(
		() =>
			focusMode ? pages.filter((page) => page.id === activePageId) : pages,
		[pages, focusMode, activePageId],
	);

	useEffect(() => {
		return monitorForElements({
			onDragStart({ location }: BaseEventPayload<ElementDragType>) {
				const outermost =
					location.initial.dropTargets[location.initial.dropTargets.length - 1];
				const source = outermost?.data.pageId === "rows" ? "rows" : "page";
				dispatchDragging({ type: "START_DRAGGING", source });
			},
			onDrop(args: BaseEventPayload<ElementDragType>) {
				handleDrop(args, pages, dispatchRow);
				dispatchDragging({ type: "STOP_DRAGGING" });
			},
		});
	}, [pages, dispatchRow, dispatchDragging]);

	useEffect(() => {
		const element = canvasRef.current;
		if (!element) {
			return;
		}

		const clearSelection = (event: MouseEvent) => {
			if (event.target === event.currentTarget) {
				dispatchRow({ type: "CLEAR_ACTIVE_SELECTION" });
			}
		};

		element.addEventListener("click", clearSelection);

		return () => {
			element.removeEventListener("click", clearSelection);
		};
	}, [dispatchRow]);

	return (
		<>
			<div className="evy-w-300 evy-flex-shrink-0 evy-border-r evy-border-gray evy-bg-white evy-shadow-subtle">
				<RowsPanel />
			</div>
			<div
				className="evy-flex-1 evy-overflow-auto evy-flex evy-flex-row evy-gap-4 evy-p-4"
				ref={canvasRef}
			>
				{visiblePages.map((page) => {
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

function NavBar() {
	const { activePageId, activeFlowId, flows, dispatchRow, focusMode } =
		useContext(AppContext);

	const activePage = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.find((p) => p.id === activePageId),
		[flows, activeFlowId, activePageId],
	);

	return (
		<div className="evy-border-b evy-border-gray evy-p-2 evy-bg-white evy-flex evy-items-center">
			<a href="/">
				<img className="evy-h-4" src="/logo.svg" alt="EVY" />
			</a>
			<div className="evy-flex-1 evy-flex evy-justify-center evy-items-center evy-gap-2">
				{activePage && (
					<>
						<input
							type="text"
							value={activePage.title}
							onChange={(e) =>
								dispatchRow({
									type: "UPDATE_PAGE_TITLE",
									pageId: activePage.id,
									title: e.target.value,
								})
							}
							placeholder="Page title"
							className="evy-navbar-page-title evy-text-center evy-bg-transparent evy-border-none evy-focus-visible:outline-none evy-text-lg evy-font-semibold"
							aria-label="Page title"
						/>
						<button
							type="button"
							onClick={() => dispatchRow({ type: "TOGGLE_FOCUS_MODE" })}
							className={`evy-focus-button ${
								focusMode ? "evy-focus-button--active" : ""
							}`}
							aria-pressed={focusMode}
						>
							Focus
						</button>
					</>
				)}
			</div>
			<FlowSelector />
		</div>
	);
}

export function App() {
	const { flows, loading } = useFlows();
	const usingInjectedTestFlows = Boolean(window.__TEST_FLOWS__);

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
				<NavBar />
				<div className="evy-flex evy-flex-1 evy-overflow-hidden evy-bg-gray-light">
					<AppContent />
				</div>
			</div>
		</AppProvider>
	);
}
