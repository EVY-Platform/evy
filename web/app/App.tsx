import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";

import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { FileSliders, Rows3 } from "lucide-react";
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
import { AppProvider, useDragContext, useFlowsContext } from "./state";
import { handleDrop } from "./utils/dropHandler";
import { useFlows } from "./hooks/useFlows";
import { findFlowById } from "./utils/flowHelpers";
import { findRowInPages } from "./utils/rowTree";
import {
	addPageButtonStyle,
	canvasContentStyle,
	collapsedPanelBarStyle,
	pageWrapperHiddenStyle,
	pageWrapperStyle,
	panelContentFadeTransitionStyle,
	panelShadowStyle,
	rightPanelStyle,
	secondaryPageWrapperStyle,
	sidePanelWidthTransitionStyle,
} from "./appLayoutStyles";
import { LUCIDE_STROKE_WIDTH } from "./icons/iconSyntax";

const PANEL_EXPANDED_WIDTH_PX = 300;

const COLLAPSED_PANEL_ICON_STYLE = { color: "var(--color-evy-gray)" };

function useHoverToggle() {
	const [hovered, setHovered] = useState(false);
	const open = useCallback(() => {
		setHovered(true);
	}, []);
	const close = useCallback(() => {
		setHovered(false);
	}, []);
	return { hovered, open, close };
}

type CollapsibleSidePanelSide = "left" | "right";

function CollapsibleSidePanel({
	side,
	isExpanded,
	pinOpenByPage,
	onOpenInteraction,
	onCloseInteraction,
	collapsedLabel,
	icon,
	children,
}: {
	side: CollapsibleSidePanelSide;
	isExpanded: boolean;
	pinOpenByPage: boolean;
	onOpenInteraction: () => void;
	onCloseInteraction: () => void;
	collapsedLabel: string;
	icon: ReactNode;
	children: ReactNode;
}) {
	const outerRef = useRef<HTMLDivElement>(null);
	const isExpandedRef = useRef(isExpanded);
	const [contentVisible, setContentVisible] = useState(isExpanded);

	isExpandedRef.current = isExpanded;

	useEffect(() => {
		if (!isExpanded) {
			setContentVisible(false);
		}
	}, [isExpanded]);

	useEffect(() => {
		const node = outerRef.current;
		if (!node) return;

		const onTransitionEnd = (event: TransitionEvent) => {
			if (event.propertyName !== "width") return;
			if (!isExpandedRef.current) return;
			setContentVisible(true);
		};

		node.addEventListener("transitionend", onTransitionEnd);
		return () => node.removeEventListener("transitionend", onTransitionEnd);
	}, []);

	const outerStyle = useMemo<CSSProperties>(() => {
		return {
			...sidePanelWidthTransitionStyle,
			position: "absolute",
			top: 0,
			bottom: 0,
			zIndex: 20,
			width: isExpanded ? PANEL_EXPANDED_WIDTH_PX : "var(--size-nav-bar)",
			...(side === "left" ? { left: 0 } : { right: 0 }),
			...(side === "left" ? panelShadowStyle : rightPanelStyle),
		};
	}, [isExpanded, side]);

	useEffect(() => {
		const node = outerRef.current;
		if (!node) return;

		const handleMouseLeave = () => {
			if (!pinOpenByPage) {
				onCloseInteraction();
			}
		};

		node.addEventListener("mouseenter", onOpenInteraction);
		node.addEventListener("mouseleave", handleMouseLeave);
		return () => {
			node.removeEventListener("mouseenter", onOpenInteraction);
			node.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [onOpenInteraction, onCloseInteraction, pinOpenByPage]);

	const outerClassName =
		side === "left"
			? "evy-flex evy-flex-col evy-overflow-hidden evy-bg-white evy-border-r evy-border-gray"
			: "evy-flex evy-flex-col evy-overflow-hidden evy-bg-white evy-border-gray";

	const innerClassName =
		side === "left"
			? "evy-flex evy-flex-1 evy-min-h-0 evy-flex-col evy-overflow-hidden"
			: "evy-flex evy-flex-1 evy-min-h-0 evy-flex-col evy-overflow-y-auto";

	const innerContentStyle = useMemo(
		() => ({
			...panelContentFadeTransitionStyle,
			opacity: contentVisible ? 1 : 0,
			pointerEvents: contentVisible ? ("auto" as const) : ("none" as const),
		}),
		[contentVisible],
	);

	return (
		<div ref={outerRef} className={outerClassName} style={outerStyle}>
			{isExpanded ? (
				<div className={innerClassName} style={innerContentStyle}>
					{children}
				</div>
			) : (
				<button
					type="button"
					style={collapsedPanelBarStyle}
					className="evy-cursor-pointer evy-border-none evy-bg-white evy-focus-visible:outline-none"
					onClick={onOpenInteraction}
					aria-label={collapsedLabel}
				>
					{icon}
				</button>
			)}
		</div>
	);
}

function AppContent() {
	const {
		dispatchRow,
		activePageId,
		focusMode,
		secondarySheetRowId,
		flows,
		activeFlowId,
	} = useFlowsContext();
	const { dragging, dispatchDragging } = useDragContext();

	const rowsHover = useHoverToggle();
	const configurationHover = useHoverToggle();

	const pinSidePanelsOpenByPage = Boolean(activePageId);
	const expandSidePanelsForPageDrag = dragging === "page";
	const isRowsPanelExpanded =
		pinSidePanelsOpenByPage || expandSidePanelsForPageDrag || rowsHover.hovered;
	const isConfigurationPanelExpanded =
		pinSidePanelsOpenByPage ||
		expandSidePanelsForPageDrag ||
		configurationHover.hovered;

	useEffect(() => {
		if (!pinSidePanelsOpenByPage && !expandSidePanelsForPageDrag) {
			rowsHover.close();
			configurationHover.close();
		}
	}, [
		pinSidePanelsOpenByPage,
		expandSidePanelsForPageDrag,
		rowsHover.close,
		configurationHover.close,
	]);

	const pages = useMemo(
		() => findFlowById(flows, activeFlowId)?.pages ?? [],
		[flows, activeFlowId],
	);

	const secondarySheetRow = useMemo(() => {
		if (!secondarySheetRowId || !focusMode) return undefined;
		return findRowInPages(secondarySheetRowId, pages);
	}, [secondarySheetRowId, focusMode, pages]);

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
			return;
		}
		dispatchRow({ type: "CLEAR_ACTIVE_SELECTION" });
	}, [dispatchRow, secondarySheetRowId]);

	const showAddPageButton = Boolean(activeFlowId) && !focusMode;

	return (
		<div className="evy-relative evy-flex-1 evy-min-h-0 evy-min-w-0 evy-overflow-hidden">
			<div className="evy-absolute evy-inset-0 evy-flex evy-min-h-0 evy-flex-col">
				<CanvasViewport
					contentStyle={canvasContentStyle}
					onBackgroundClick={clearSelectionOnBackground}
					focusMode={focusMode}
					activePageId={activePageId}
				>
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
								>
									<AppPage pageId={page.id} />
								</CanvasPageFrame>
								{focusMode && isActive && secondarySheetRow && (
									<CanvasPageFrame
										wrapperStyle={secondaryPageWrapperStyle}
										className="evy-flex-shrink-0 evy-bg-phone evy-bg-no-repeat evy-bg-contain"
										data-testid="secondary-sheet-page"
									>
										<SecondarySheetPage sheetRowId={secondarySheetRow.id} />
									</CanvasPageFrame>
								)}
							</Fragment>
						);
					})}
				</CanvasViewport>
			</div>
			{showAddPageButton && (
				<button
					type="button"
					onClick={() => dispatchRow({ type: "ADD_PAGE" })}
					style={addPageButtonStyle}
					className="evy-bg-white evy-border evy-border-gray-dark evy-rounded-full evy-px-4 evy-py-2 evy-text-sm evy-cursor-pointer evy-text-gray-dark evy-font-medium evy-focus-visible:outline-none"
					aria-label="Add a page"
				>
					Add a page
				</button>
			)}
			<CollapsibleSidePanel
				side="left"
				isExpanded={isRowsPanelExpanded}
				pinOpenByPage={pinSidePanelsOpenByPage}
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
				pinOpenByPage={pinSidePanelsOpenByPage}
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
