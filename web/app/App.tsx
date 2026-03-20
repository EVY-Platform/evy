import { Fragment, useCallback, useEffect, useMemo } from "react";

import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";

import AppPage from "./components/AppPage";
import SecondarySheetPage from "./components/SecondarySheetPage";
import { ConfigurationPanel } from "./components/ConfigurationPanel";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";
import { RowsPanel } from "./components/RowsPanel";
import { CanvasViewport } from "./components/CanvasViewport";
import { CanvasPageFrame } from "./components/CanvasPageFrame";
import { FocusPanOnEnter } from "./components/FocusPanOnEnter";
import { AppProvider, useDragContext, useFlowsContext } from "./state";
import { handleDrop } from "./utils/dropHandler";
import { useFlows } from "./hooks/useFlows";
import { findFlowById } from "./utils/flowHelpers";
import { findRowInPages } from "./utils/rowTree";
import {
	canvasContentStyle,
	pageWrapperHiddenStyle,
	pageWrapperStyle,
	panelShadowStyle,
	rightPanelStyle,
	secondaryPageWrapperHiddenStyle,
	secondaryPageWrapperStyle,
} from "./appLayoutStyles";

function AppContent() {
	const {
		dispatchRow,
		activePageId,
		focusMode,
		secondarySheetRowId,
		flows,
		activeFlowId,
	} = useFlowsContext();
	const { dispatchDragging } = useDragContext();

	const pages = useMemo(
		() => findFlowById(flows, activeFlowId)?.pages ?? [],
		[flows, activeFlowId],
	);

	const secondarySheetRow = useMemo(() => {
		if (!secondarySheetRowId || !focusMode) return undefined;
		return findRowInPages(secondarySheetRowId, pages);
	}, [secondarySheetRowId, focusMode, pages]);

	const showSecondary = Boolean(secondarySheetRow);

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

	const clearSelectionOnBackground = useCallback(() => {
		if (secondarySheetRowId) {
			dispatchRow({ type: "CLOSE_SECONDARY_SHEET" });
		} else if (!focusMode) {
			dispatchRow({ type: "CLEAR_ACTIVE_SELECTION" });
		}
	}, [dispatchRow, secondarySheetRowId, focusMode]);

	/** Only virtualize when many pages; small flows keep all pages mounted for reliability. */
	const cullingDisabled = focusMode || pages.length <= 12;

	return (
		<>
			<div
				className="evy-w-300 evy-flex-shrink-0 evy-border-r evy-border-gray evy-bg-white"
				style={panelShadowStyle}
			>
				<RowsPanel />
			</div>
			<div className="evy-flex evy-flex-1 evy-min-h-0 evy-flex-col evy-overflow-hidden">
				<CanvasViewport
					contentStyle={canvasContentStyle}
					onBackgroundClick={clearSelectionOnBackground}
				>
					<FocusPanOnEnter focusMode={focusMode} activePageId={activePageId} />
					{pages.map((page) => {
						const isActive = page.id === activePageId;
						const isHidden = focusMode && !isActive;
						const wrapperStyle = isHidden
							? pageWrapperHiddenStyle
							: pageWrapperStyle;

						return (
							<Fragment key={page.id}>
								<CanvasPageFrame
									pageId={page.id}
									wrapperStyle={wrapperStyle}
									className="evy-flex-shrink-0 evy-bg-phone evy-bg-no-repeat evy-bg-contain"
									cullingDisabled={cullingDisabled}
								>
									<AppPage pageId={page.id} />
								</CanvasPageFrame>
								{focusMode && isActive && (
									<CanvasPageFrame
										wrapperStyle={
											showSecondary
												? secondaryPageWrapperStyle
												: secondaryPageWrapperHiddenStyle
										}
										className="evy-flex-shrink-0 evy-bg-phone evy-bg-no-repeat evy-bg-contain"
										cullingDisabled
										data-testid="secondary-sheet-page"
									>
										{secondarySheetRow && (
											<SecondarySheetPage sheetRowId={secondarySheetRow.id} />
										)}
									</CanvasPageFrame>
								)}
							</Fragment>
						);
					})}
				</CanvasViewport>
			</div>
			<div
				className="evy-w-300 evy-flex-shrink-0 evy-border-gray evy-overflow-y-auto evy-bg-white"
				style={rightPanelStyle}
			>
				<ConfigurationPanel />
			</div>
		</>
	);
}

function NavBar() {
	return (
		<div className="evy-border-b evy-border-gray evy-p-2 evy-bg-white evy-flex evy-items-center evy-gap-2 evy-min-w-0">
			<a href="/" className="evy-shrink-0">
				<img className="evy-h-4" src="/logo.svg" alt="EVY" />
			</a>
			<NavigationBreadcrumb />
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
				<div className="evy-text-red evy-text-lg">Failed to load flows</div>
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
				<div className="evy-flex evy-flex-1 evy-min-h-0 evy-overflow-hidden evy-bg-gray-light">
					<AppContent />
				</div>
			</div>
		</AppProvider>
	);
}
