import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";
import { FileSliders, Rows3 } from "lucide-react";
import {
	Fragment,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import {
	activePageWithPhoneStyle,
	canvasContentStyle,
	pageWithPhoneStyle,
	secondaryPageWithPhoneStyle,
} from "./appLayoutStyles";
import AppPage from "./components/AppPage";

import { BlankSheetPage } from "./components/BlankSheetPage";
import { CanvasLoadingIndicator } from "./components/CanvasLoadingIndicator";
import { CanvasPageFrame } from "./components/CanvasPageFrame";
import { CanvasViewport } from "./components/CanvasViewport";
import {
	CollapsibleSidePanel,
	useHoverToggle,
} from "./components/CollapsibleSidePanel";
import { ConfigurationPanel } from "./components/ConfigurationPanel";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";
import { RowsPanel } from "./components/RowsPanel";
import { SheetPage } from "./components/SheetPage";
import { useFlows } from "./hooks/useFlows";
import { useRowById } from "./hooks/useRowById";
import { LUCIDE_STROKE_WIDTH } from "./icons/iconSyntax";
import { AppProvider } from "./state/AppProvider";
import { useDragContext } from "./state/contexts/DragContext";
import { useFlowsContext } from "./state/contexts/FlowsContext";
import { handleDrop } from "./utils/dropHandler";
import { serverFlowsToCollections } from "./utils/flowEntities";
import { capturePageFramePosition } from "./utils/preActivationCapture";
import { buildActiveSheetPages } from "./utils/sheetPageHelpers";

const COLLAPSED_PANEL_ICON_STYLE = { color: "var(--color-evy-gray)" };
const noop = () => {};

type SidePanelsProps =
	| { mode: "loading" }
	| {
			mode: "active";
			isRowsPanelExpanded: boolean;
			isConfigPanelExpanded: boolean;
			pinOpenByPage: boolean;
			onRowsOpen: () => void;
			onRowsClose: () => void;
			onConfigOpen: () => void;
			onConfigClose: () => void;
	  };

function SidePanels(props: SidePanelsProps) {
	const isActive = props.mode === "active";
	return (
		<>
			<CollapsibleSidePanel
				side="left"
				isExpanded={isActive && props.isRowsPanelExpanded}
				pinOpenByPage={isActive && props.pinOpenByPage}
				onOpenInteraction={isActive ? props.onRowsOpen : noop}
				onCloseInteraction={isActive ? props.onRowsClose : noop}
				collapsedLabel={
					isActive ? "Expand rows panel" : "Rows panel loading"
				}
				icon={
					<Rows3
						size={20}
						strokeWidth={LUCIDE_STROKE_WIDTH}
						style={COLLAPSED_PANEL_ICON_STYLE}
						aria-hidden
					/>
				}
			>
				{isActive ? <RowsPanel /> : null}
			</CollapsibleSidePanel>
			<CollapsibleSidePanel
				side="right"
				isExpanded={isActive && props.isConfigPanelExpanded}
				pinOpenByPage={isActive && props.pinOpenByPage}
				onOpenInteraction={isActive ? props.onConfigOpen : noop}
				onCloseInteraction={isActive ? props.onConfigClose : noop}
				collapsedLabel={
					isActive
						? "Expand configuration panel"
						: "Configuration panel loading"
				}
				icon={
					<FileSliders
						size={20}
						strokeWidth={LUCIDE_STROKE_WIDTH}
						style={COLLAPSED_PANEL_ICON_STYLE}
						aria-hidden
					/>
				}
			>
				{isActive ? <ConfigurationPanel /> : null}
			</CollapsibleSidePanel>
		</>
	);
}

function AppContent() {
	const {
		dispatchRow,
		activePageId,
		activeRowId,
		configStack,
		flowsById,
		pagesById,
		rowsById,
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

	const activePage = activePageId ? pagesById[activePageId] : undefined;

	const activeFlowPageIds = useMemo(
		() => flowsById[activeFlowId ?? ""]?.pageIds ?? [],
		[flowsById, activeFlowId],
	);

	useLayoutEffect(() => {
		return monitorForElements({
			onDragStart({ location }: BaseEventPayload<ElementDragType>) {
				const outermost =
					location.initial.dropTargets[
						location.initial.dropTargets.length - 1
					];
				const source =
					outermost?.data.pageId === "rows" ? "rows" : "page";
				dispatchDragging({ type: "START_DRAGGING", source });
			},
			onDrop(args: BaseEventPayload<ElementDragType>) {
				handleDrop(
					args,
					{ flowsById, pagesById, rowsById },
					activeFlowId ?? "",
					dispatchRow,
				);
				dispatchDragging({ type: "STOP_DRAGGING" });
			},
		});
	}, [
		flowsById,
		pagesById,
		rowsById,
		activeFlowId,
		dispatchRow,
		dispatchDragging,
	]);

	const clearSelectionOnBackground = () => {
		if (activePageId) {
			capturePageFramePosition(activePageId);
		}
		dispatchRow({ type: "CLEAR_ACTIVE_SELECTION" });
	};

	const showAddPageButton = Boolean(activeFlowId) && !isElementActive;

	const activeLeafRowId =
		configStack.length > 0
			? configStack[configStack.length - 1]
			: activeRowId;

	const activeLeafRow = useRowById(activeLeafRowId);

	const sheetPages = useMemo(
		() => buildActiveSheetPages({ activeRowId, configStack, rowsById }),
		[activeRowId, configStack, rowsById],
	);

	const shouldShowBlankSheetPage = Boolean(
		activeLeafRowId && !activeLeafRow?.config.sheetRowId,
	);

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

							{sheetPages.map(({ sheetRowId, parentRowId }) => (
								<CanvasPageFrame
									key={sheetRowId}
									wrapperStyle={secondaryPageWithPhoneStyle}
									className="evy-flex-shrink-0"
									data-testid="sheet-page"
								>
									<SheetPage
										sheetRowId={sheetRowId}
										pageId={activePage.id}
										parentRowId={parentRowId}
									/>
								</CanvasPageFrame>
							))}

							{shouldShowBlankSheetPage && (
								<CanvasPageFrame
									wrapperStyle={secondaryPageWithPhoneStyle}
									className="evy-flex-shrink-0"
									data-testid="blank-sheet-page"
								>
									<BlankSheetPage
										pageId={activePage.id}
										parentRowId={activeLeafRowId}
									/>
								</CanvasPageFrame>
							)}
						</Fragment>
					) : (
						activeFlowPageIds.map((pageId) => (
							<CanvasPageFrame
								key={pageId}
								pageId={pageId}
								wrapperStyle={pageWithPhoneStyle}
								className="evy-flex-shrink-0"
							>
								<AppPage pageId={pageId} />
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
			<SidePanels
				mode="active"
				isRowsPanelExpanded={isRowsPanelExpanded}
				isConfigPanelExpanded={isConfigurationPanelExpanded}
				pinOpenByPage={isElementActive}
				onRowsOpen={rowsHover.open}
				onRowsClose={rowsHover.close}
				onConfigOpen={configurationHover.open}
				onConfigClose={configurationHover.close}
			/>
		</div>
	);
}

function AppShell({
	children,
	showBreadcrumb = true,
}: {
	children: ReactNode;
	showBreadcrumb?: boolean;
}) {
	return (
		<div className="evy-h-screen evy-overflow-hidden evy-flex evy-flex-col">
			<NavBar showBreadcrumb={showBreadcrumb} />
			<div className="evy-relative evy-flex evy-flex-1 evy-min-h-0 evy-overflow-hidden evy-bg-gray-light">
				{children}
			</div>
		</div>
	);
}

function NavBar({ showBreadcrumb }: { showBreadcrumb: boolean }) {
	return (
		<div className="evy-border-b evy-border-gray evy-p-2 evy-bg-white evy-flex evy-items-center evy-gap-2 evy-min-w-0 evy-min-h-nav-bar">
			<a href="/" className="evy-shrink-0">
				<img className="evy-h-4" src="/logo.svg" alt="EVY" />
			</a>
			{showBreadcrumb && <NavigationBreadcrumb />}
		</div>
	);
}

function PlaceholderShell({ children }: { children: ReactNode }) {
	return (
		<AppShell showBreadcrumb={false}>
			<CanvasViewport contentStyle={canvasContentStyle}>
				{null}
			</CanvasViewport>
			<SidePanels mode="loading" />
			{children}
		</AppShell>
	);
}

export function App() {
	const {
		flowGraph,
		serviceResources,
		resourceAttributeMetadata,
		serviceNamesById,
		formatters,
		loading,
		error,
	} = useFlows();
	const testFlows = window.__TEST_FLOWS__;
	const testServiceResources = window.__TEST_SERVICE_RESOURCES__;
	const testResourceAttributeMetadata =
		window.__TEST_RESOURCE_ATTRIBUTE_METADATA__;
	const initialFlowGraph = testFlows
		? serverFlowsToCollections(testFlows)
		: flowGraph;
	const initialServiceResources = testFlows
		? (testServiceResources ?? [])
		: serviceResources;
	const initialResourceAttributeMetadata = testFlows
		? (testResourceAttributeMetadata ?? [])
		: resourceAttributeMetadata;
	const initialServiceNamesById = testFlows
		? new Map(
				[
					...new Set(
						(testServiceResources ?? []).map(
							(resource) => resource.serviceId,
						),
					),
				].map((serviceId) => [
					serviceId,
					window.__TEST_SERVICE_NAMES__?.[serviceId] ?? serviceId,
				]),
			)
		: serviceNamesById;
	const initialFormatters = testFlows ? [] : formatters;

	const [minTimeElapsed, setMinTimeElapsed] = useState(Boolean(testFlows));
	const [exiting, setExiting] = useState(false);
	const [showContent, setShowContent] = useState(Boolean(testFlows));

	useEffect(() => {
		if (testFlows) return;
		const timer = setTimeout(() => setMinTimeElapsed(true), 500);
		return () => clearTimeout(timer);
	}, []);

	const ready =
		!loading && Boolean(initialFlowGraph) && !error && minTimeElapsed;

	useEffect(() => {
		if (!ready || showContent) return;
		setExiting(true);
		const timer = setTimeout(() => {
			setExiting(false);
			setShowContent(true);
		}, 200);
		return () => clearTimeout(timer);
	}, [ready, showContent]);

	if (error && !loading && !testFlows) {
		return (
			<PlaceholderShell>
				<div className="evy-absolute evy-inset-0 evy-flex evy-items-center evy-justify-center">
					<span className="evy-text-red evy-text-lg">
						Failed to load flows
					</span>
				</div>
			</PlaceholderShell>
		);
	}

	if (!showContent) {
		return (
			<PlaceholderShell>
				<CanvasLoadingIndicator isExiting={exiting} />
			</PlaceholderShell>
		);
	}

	return (
		<AppProvider
			initialFlowGraph={
				initialFlowGraph ?? { flows: [], pages: [], rows: [] }
			}
			serviceResources={initialServiceResources}
			resourceAttributeMetadata={initialResourceAttributeMetadata}
			serviceNamesById={initialServiceNamesById}
			formatters={initialFormatters}
			syncWithApi={!testFlows}
		>
			<AppShell>
				<AppContent />
			</AppShell>
		</AppProvider>
	);
}
