import {
	Fragment,
	useEffect,
	useLayoutEffect,
	useMemo,
	type CSSProperties,
} from "react";

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

import {
	activePageWrapperStyle,
	canvasContentStyle,
	pageWrapperStyle,
	secondaryPageWrapperStyle,
} from "./appLayoutStyles";
import { LUCIDE_STROKE_WIDTH } from "./icons/iconSyntax";
import type { Row } from "./types/row";

const COLLAPSED_PANEL_ICON_STYLE = { color: "var(--color-evy-gray)" };
const PHONE_FRAME_STYLE: CSSProperties = {
	backgroundImage: 'url("/phone.svg")',
	backgroundRepeat: "no-repeat",
	backgroundSize: "contain",
};
function buildActiveChildPageRows({
	activeRowId,
	configStack,
	pages,
}: {
	activeRowId: string | undefined;
	configStack: string[];
	pages: { rows: Row[]; footer?: Row }[];
}): Row[] {
	if (!activeRowId) return [];

	const activeRootRow = findRowInPages(activeRowId, pages);
	if (!activeRootRow) return [];

	const childPageRows: Row[] = [];
	let currentParentRow = activeRootRow;

	for (const selectedDescendantRowId of configStack) {
		const singularChild = currentParentRow.config.view.content.child;
		if (singularChild?.id === selectedDescendantRowId) {
			childPageRows.push(singularChild);
			currentParentRow = singularChild;
			continue;
		}

		const nestedChild = currentParentRow.config.view.content.children?.find(
			(child) => child.id === selectedDescendantRowId,
		);
		if (nestedChild) {
			currentParentRow = nestedChild;
			continue;
		}

		const fallbackRow = findRowInPages(selectedDescendantRowId, pages);
		if (!fallbackRow) return childPageRows;
		currentParentRow = fallbackRow;
	}

	const nextChildRow = currentParentRow.config.view.content.child;
	if (nextChildRow) {
		childPageRows.push(nextChildRow);
	}

	return childPageRows;
}

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
		isElementActive ||
		expandSidePanelsForPageDrag ||
		configurationHover.hovered;

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
	const activeLeafChild = activeLeafRow?.config.view.content.child;
	const childPageRows = useMemo(
		() => buildActiveChildPageRows({ activeRowId, configStack, pages }),
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
								wrapperStyle={{
									...activePageWrapperStyle,
									...PHONE_FRAME_STYLE,
								}}
								className="evy-flex-shrink-0"
							>
								<AppPage pageId={activePage.id} />
							</CanvasPageFrame>

							{childPageRows.map((childPageRow) => (
								<CanvasPageFrame
									key={childPageRow.id}
									wrapperStyle={{
										...secondaryPageWrapperStyle,
										...PHONE_FRAME_STYLE,
									}}
									className="evy-flex-shrink-0"
									data-testid="child-page"
								>
									<ChildPage childRow={childPageRow} />
								</CanvasPageFrame>
							))}

							{shouldShowBlankChildPage && (
								<CanvasPageFrame
									wrapperStyle={{
										...secondaryPageWrapperStyle,
										...PHONE_FRAME_STYLE,
									}}
									className="evy-flex-shrink-0"
									data-testid="blank-child-page"
								>
									<BlankChildPage parentRowId={activeLeafRowId} />
								</CanvasPageFrame>
							)}
						</Fragment>
					) : (
						pages.map((page) => (
							<CanvasPageFrame
								key={page.id}
								pageId={page.id}
								wrapperStyle={{
									...pageWrapperStyle,
									...PHONE_FRAME_STYLE,
								}}
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
