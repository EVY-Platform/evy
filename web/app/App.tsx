import { Fragment, useEffect, useLayoutEffect, useMemo } from "react";

import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { FileSliders, Rows3 } from "lucide-react";
import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";

import AppPage from "./components/AppPage";
import {
	CollapsibleSidePanel,
	useHoverToggle,
} from "./components/CollapsibleSidePanel";

import { BlankChildPage } from "./components/BlankChildPage";
import { ChildPage } from "./components/ChildPage";
import { ConfigurationPanel } from "./components/ConfigurationPanel";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";
import { RowsPanel } from "./components/RowsPanel";
import { CanvasViewport } from "./components/CanvasViewport";
import { CanvasPageFrame } from "./components/CanvasPageFrame";
import { AppProvider, useDragContext, useFlowsContext } from "./state";
import { handleDrop } from "./utils/dropHandler";
import { useFlows } from "./hooks/useFlows";
import { findFlowById } from "./utils/flowHelpers";
import { findRowInPages } from "./utils/rowTree";
import { capturePageFramePosition } from "./utils/preActivationCapture";
import { buildActiveChildPages } from "./utils/childPageHelpers";

import {
	activePageWithPhoneStyle,
	secondaryPageWithPhoneStyle,
	pageWithPhoneStyle,
	canvasContentStyle,
} from "./appLayoutStyles";
import { LUCIDE_STROKE_WIDTH } from "./icons/iconSyntax";

const COLLAPSED_PANEL_ICON_STYLE = { color: "var(--color-evy-gray)" };

function AppContent() {
	const {
		dispatchRow,
		activePageId,
		activeRowId,
		configStack,
		flows,
		activeFlowId,
	} = useFlowsContext();
	const { dragging, dispatchDragging } = useDragContext();

	const rowsHover = useHoverToggle();
	const configurationHover = useHoverToggle();

	const isElementActive = Boolean(activePageId);

	const expandSidePanelsForPageDrag = dragging === "page";
	const isRowsPanelExpanded =
		isElementActive || expandSidePanelsForPageDrag || rowsHover.hovered;
	const isConfigurationPanelExpanded =
		isElementActive || configurationHover.hovered;

	useEffect(() => {
		if (!isElementActive && !expandSidePanelsForPageDrag) {
			rowsHover.close();
			configurationHover.close();
		}
	}, [
		isElementActive,
		expandSidePanelsForPageDrag,
		rowsHover.close,
		configurationHover.close,
	]);

	const pages = useMemo(
		() => findFlowById(flows, activeFlowId)?.pages ?? [],
		[flows, activeFlowId],
	);

	const activePage = useMemo(
		() => pages.find((page) => page.id === activePageId),
		[pages, activePageId],
	);

	useLayoutEffect(() => {
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

	const clearSelectionOnBackground = () => {
		if (activePageId) {
			capturePageFramePosition(activePageId);
		}
		dispatchRow({ type: "CLEAR_ACTIVE_SELECTION" });
	};

	const showAddPageButton = Boolean(activeFlowId) && !isElementActive;

	const activeLeafRowId =
		configStack.length > 0 ? configStack[configStack.length - 1] : activeRowId;

	const activeLeafRow = activeLeafRowId
		? findRowInPages(activeLeafRowId, pages)
		: undefined;
	const isSearchParent = activeLeafRow?.config.type === "Search";
	const activeLeafChild = activeLeafRow?.config.view.content.child;
	const childPages = useMemo(
		() => buildActiveChildPages({ activeRowId, configStack, pages }),
		[activeRowId, configStack, pages],
	);

	const shouldShowBlankChildPage = Boolean(activeLeafRowId && !activeLeafChild);

	return (
		<div className="evy-relative evy-flex-1 evy-min-h-0 evy-min-w-0 evy-overflow-hidden">
			<div className="evy-absolute evy-inset-0 evy-flex evy-min-h-0 evy-flex-col">
				<CanvasViewport
					contentStyle={canvasContentStyle}
					onBackgroundClick={clearSelectionOnBackground}
					shouldPanToActive={isElementActive}
					activePageId={activePageId}
					activeFlowId={activeFlowId}
				>
					{isElementActive && activePage ? (
						<Fragment key={activePage.id}>
							<CanvasPageFrame
								pageId={activePage.id}
								wrapperStyle={activePageWithPhoneStyle}
								className="evy-flex-shrink-0"
							>
								<AppPage pageId={activePage.id} />
							</CanvasPageFrame>

							{childPages.map(({ childRow, parentRowId }) => {
								const parentRow = findRowInPages(parentRowId, pages);
								const childVariant =
									parentRow?.config.type === "Search" ? "full" : "sheet";
								return (
									<CanvasPageFrame
										key={childRow.id}
										wrapperStyle={secondaryPageWithPhoneStyle}
										className="evy-flex-shrink-0"
										data-testid="child-page"
									>
										<ChildPage
											childRow={childRow}
											pageId={activePage.id}
											parentRowId={parentRowId}
											variant={childVariant}
										/>
									</CanvasPageFrame>
								);
							})}

							{shouldShowBlankChildPage && (
								<CanvasPageFrame
									wrapperStyle={secondaryPageWithPhoneStyle}
									className="evy-flex-shrink-0"
									data-testid="blank-child-page"
								>
									<BlankChildPage
										pageId={activePage.id}
										parentRowId={activeLeafRowId}
										variant={isSearchParent ? "full" : "sheet"}
									/>
								</CanvasPageFrame>
							)}
						</Fragment>
					) : (
						pages.map((page) => (
							<CanvasPageFrame
								key={page.id}
								pageId={page.id}
								wrapperStyle={pageWithPhoneStyle}
								className="evy-flex-shrink-0"
							>
								<AppPage pageId={page.id} />
							</CanvasPageFrame>
						))
					)}
				</CanvasViewport>
			</div>
			{showAddPageButton && (
				<button
					type="button"
					onClick={() => dispatchRow({ type: "ADD_PAGE" })}
					style={{
						position: "absolute",
						bottom: "var(--size-4)",
						left: "50%",
						transform: "translateX(-50%)",
						zIndex: 15,
						borderColor: "var(--color-evy-gray-dark)",
						borderRadius: "var(--radius-md)",
					}}
					className="evy-bg-white evy-border evy-px-4 evy-py-2 evy-text-sm evy-cursor-pointer evy-text-gray-dark evy-font-medium evy-focus-visible:outline-none"
					aria-label="Add a page"
				>
					Add a page
				</button>
			)}
			<CollapsibleSidePanel
				side="left"
				isExpanded={isRowsPanelExpanded}
				pinOpenByPage={isElementActive}
				onOpenInteraction={rowsHover.open}
				onCloseInteraction={rowsHover.close}
				collapsedLabel="Expand rows panel"
				icon={
					<Rows3
						size={20}
						strokeWidth={LUCIDE_STROKE_WIDTH}
						style={COLLAPSED_PANEL_ICON_STYLE}
						aria-hidden
					/>
				}
			>
				<RowsPanel />
			</CollapsibleSidePanel>
			<CollapsibleSidePanel
				side="right"
				isExpanded={isConfigurationPanelExpanded}
				pinOpenByPage={isElementActive}
				onOpenInteraction={configurationHover.open}
				onCloseInteraction={configurationHover.close}
				collapsedLabel="Expand configuration panel"
				icon={
					<FileSliders
						size={20}
						strokeWidth={LUCIDE_STROKE_WIDTH}
						style={COLLAPSED_PANEL_ICON_STYLE}
						aria-hidden
					/>
				}
			>
				<ConfigurationPanel />
			</CollapsibleSidePanel>
		</div>
	);
}

function NavBar() {
	return (
		<div className="evy-border-b evy-border-gray evy-p-2 evy-bg-white evy-flex evy-items-center evy-gap-2 evy-min-w-0 evy-min-h-nav-bar">
			<a href="/" className="evy-shrink-0">
				<img className="evy-h-4" src="/logo.svg" alt="EVY" />
			</a>
			<NavigationBreadcrumb />
		</div>
	);
}

export function App() {
	const { flows, loading } = useFlows();
	const testFlows = window.__TEST_FLOWS__;
	const initialFlows = testFlows ?? flows;

	if (loading && !testFlows) {
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
		<AppProvider initialFlows={initialFlows} syncWithApi={!testFlows}>
			<div className="evy-h-screen evy-overflow-hidden evy-flex evy-flex-col">
				<NavBar />
				<div className="evy-flex evy-flex-1 evy-min-h-0 evy-overflow-hidden evy-bg-gray-light">
					<AppContent />
				</div>
			</div>
		</AppProvider>
	);
}
