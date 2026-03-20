import type { CSSProperties } from "react";
import { useContext, useEffect, useMemo, useRef } from "react";

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
import { AppContext, AppProvider } from "./state";
import { handleDrop } from "./utils/dropHandler";
import { useFlows } from "./hooks/useFlows";
import { useActiveFlow } from "./hooks/useActiveFlow";
import { findRowInPages } from "./utils/rowTree";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

function transition(
	props: Array<{ prop: string; ms?: number; delay?: number }>,
): string {
	return props
		.map(({ prop, ms = 300, delay = 0 }) =>
			delay ? `${prop} ${ms}ms ${EASE} ${delay}ms` : `${prop} ${ms}ms ${EASE}`,
		)
		.join(", ");
}

const canvasBaseStyle: CSSProperties = {
	flexDirection: "row",
	overflow: "auto",
};

const canvasStyle: CSSProperties = {
	...canvasBaseStyle,
	gap: "var(--spacing-4)",
	transition: transition([{ prop: "gap" }]),
};

const canvasFocusedStyle: CSSProperties = {
	...canvasBaseStyle,
	gap: 0,
	transition: transition([{ prop: "gap", delay: 350 }]),
};

const canvasFocusedWithSecondaryStyle: CSSProperties = {
	...canvasFocusedStyle,
	justifyContent: "center",
};

const pageWrapperBaseStyle: CSSProperties = {
	overflow: "hidden",
	height: "var(--size-662)",
};

const pageWrapperTransition = (opacityDelay: number, sizeDelay = 0) =>
	transition([
		{ prop: "opacity", ms: 350, delay: opacityDelay },
		{ prop: "width", delay: sizeDelay },
		{ prop: "margin", delay: sizeDelay },
	]);

const pageWrapperStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	marginLeft: "auto",
	marginRight: "auto",
	width: "var(--size-336)",
	transition: pageWrapperTransition(300),
};

const pageWrapperHiddenStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	opacity: 0,
	width: 0,
	marginLeft: 0,
	marginRight: 0,
	pointerEvents: "none",
	transition: pageWrapperTransition(0, 350),
};

const pageWrapperFocusedWithSecondaryStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	width: "var(--size-336)",
	marginLeft: 0,
	marginRight: 0,
	transition: pageWrapperTransition(300),
};

const secondaryPageWrapperStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	width: "var(--size-336)",
	marginLeft: "var(--spacing-4)",
	opacity: 1,
	transition: pageWrapperTransition(100),
};

const secondaryPageWrapperHiddenStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	opacity: 0,
	width: 0,
	marginLeft: 0,
	overflow: "hidden",
	pointerEvents: "none",
	transition: transition([
		{ prop: "opacity", ms: 200 },
		{ prop: "width", delay: 200 },
		{ prop: "margin", delay: 200 },
	]),
};

const panelShadowStyle: CSSProperties = {
	boxShadow: "var(--shadow-subtle)",
};

const rightPanelStyle: CSSProperties = {
	...panelShadowStyle,
	borderLeftWidth: "1px",
	borderLeftStyle: "solid",
};

function AppContent() {
	const {
		dispatchRow,
		dispatchDragging,
		activePageId,
		focusMode,
		secondarySheetRowId,
	} = useContext(AppContext);
	const { pages } = useActiveFlow();
	const canvasRef = useRef<HTMLDivElement | null>(null);

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

	useEffect(() => {
		const element = canvasRef.current;
		if (!element) {
			return;
		}

		const clearSelection = (event: MouseEvent) => {
			if (event.target === event.currentTarget) {
				if (secondarySheetRowId) {
					dispatchRow({ type: "CLOSE_SECONDARY_SHEET" });
				} else if (!focusMode) {
					dispatchRow({ type: "CLEAR_ACTIVE_SELECTION" });
				}
			}
		};

		element.addEventListener("click", clearSelection);

		return () => {
			element.removeEventListener("click", clearSelection);
		};
	}, [dispatchRow, secondarySheetRowId, focusMode]);

	return (
		<>
			<div
				className="evy-w-300 evy-flex-shrink-0 evy-border-r evy-border-gray evy-bg-white"
				style={panelShadowStyle}
			>
				<RowsPanel />
			</div>
			<div
				className="evy-flex-1 evy-flex evy-p-4"
				style={
					focusMode
						? showSecondary
							? canvasFocusedWithSecondaryStyle
							: canvasFocusedStyle
						: canvasStyle
				}
				ref={canvasRef}
			>
				{pages.map((page) => {
					const isHidden = focusMode && page.id !== activePageId;
					const isFocusedPage = focusMode && page.id === activePageId;

					let wrapperStyle = pageWrapperStyle;
					if (isHidden) {
						wrapperStyle = pageWrapperHiddenStyle;
					} else if (isFocusedPage && showSecondary) {
						wrapperStyle = pageWrapperFocusedWithSecondaryStyle;
					}

					return (
						<div
							key={page.id}
							className="evy-flex-shrink-0 evy-bg-phone evy-bg-no-repeat evy-bg-contain"
							style={wrapperStyle}
						>
							<AppPage pageId={page.id} />
						</div>
					);
				})}
				{focusMode && (
					<div
						className="evy-flex-shrink-0 evy-bg-phone evy-bg-no-repeat evy-bg-contain"
						style={
							showSecondary
								? secondaryPageWrapperStyle
								: secondaryPageWrapperHiddenStyle
						}
						data-testid="secondary-sheet-page"
					>
						{secondarySheetRow && (
							<SecondarySheetPage sheetRowId={secondarySheetRow.id} />
						)}
					</div>
				)}
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
				<div className="evy-flex evy-flex-1 evy-overflow-hidden evy-bg-gray-light">
					<AppContent />
				</div>
			</div>
		</AppProvider>
	);
}
