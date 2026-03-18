import type { CSSProperties } from "react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

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

const focusButtonCss = `
@keyframes focus-glow {
	0%, 100% { box-shadow: 0 0 6px 1px oklch(35.84% 0.0103 285.87 / 0.35); }
	50% { box-shadow: 0 0 14px 4px oklch(35.84% 0.0103 285.87 / 0.6); }
}
.evy-focus-button--active {
	border-color: var(--color-evy-gray-dark);
	box-shadow: 0 0 8px 2px oklch(35.84% 0.0103 285.87 / 0.5);
	animation: focus-glow 2s ease-in-out infinite;
}
`;

const focusButtonStyle: CSSProperties = {
	fontSize: "var(--text-sm)",
	fontWeight: "var(--font-medium)",
	height: "var(--size-navbar-control)",
	padding: "0 var(--spacing-4)",
	border: "1px solid var(--color-gray-border)",
	borderRadius: "var(--radius-md)",
	backgroundColor: "var(--color-white)",
	cursor: "pointer",
	position: "relative",
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	transition: "border-color var(--transition), box-shadow var(--transition)",
};

const focusButtonHoverStyle: CSSProperties = {
	...focusButtonStyle,
	borderColor: "var(--color-evy-gray)",
};

const canvasBaseStyle: CSSProperties = {
	flexDirection: "row",
	overflow: "auto",
};

const canvasStyle: CSSProperties = {
	...canvasBaseStyle,
	gap: "var(--spacing-4)",
	transition: "gap 300ms cubic-bezier(0.4, 0, 0.2, 1)",
};

const canvasFocusedStyle: CSSProperties = {
	...canvasBaseStyle,
	gap: 0,
	transition: "gap 300ms cubic-bezier(0.4, 0, 0.2, 1) 350ms",
};

const pageWrapperBaseStyle: CSSProperties = {
	overflow: "hidden",
	height: "var(--size-662)",
};

const pageWrapperStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	marginLeft: "auto",
	marginRight: "auto",
	width: "var(--size-336)",
	transition:
		"opacity 350ms cubic-bezier(0.4, 0, 0.2, 1) 300ms, width 300ms cubic-bezier(0.4, 0, 0.2, 1), margin 300ms cubic-bezier(0.4, 0, 0.2, 1)",
};

const pageWrapperHiddenStyle: CSSProperties = {
	...pageWrapperBaseStyle,
	opacity: 0,
	width: 0,
	marginLeft: 0,
	marginRight: 0,
	pointerEvents: "none",
	transition:
		"opacity 350ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1) 350ms, margin 300ms cubic-bezier(0.4, 0, 0.2, 1) 350ms",
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
	const { dispatchRow, dispatchDragging, activePageId, focusMode } =
		useContext(AppContext);
	const { pages } = useActiveFlow();
	const canvasRef = useRef<HTMLDivElement | null>(null);

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
			<div
				className="evy-w-300 evy-flex-shrink-0 evy-border-r evy-border-gray evy-bg-white"
				style={panelShadowStyle}
			>
				<RowsPanel />
			</div>
			<div
				className="evy-flex-1 evy-flex evy-p-4"
				style={focusMode ? canvasFocusedStyle : canvasStyle}
				ref={canvasRef}
			>
				{pages.map((page) => {
					const isHidden = focusMode && page.id !== activePageId;

					return (
						<div
							key={page.id}
							className="evy-flex-shrink-0 evy-bg-phone evy-bg-no-repeat evy-bg-contain"
							style={isHidden ? pageWrapperHiddenStyle : pageWrapperStyle}
						>
							<AppPage pageId={page.id} />
						</div>
					);
				})}
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
	const { activePageId, activeFlowId, flows, dispatchRow, focusMode } =
		useContext(AppContext);
	const [focusBtnHovered, setFocusBtnHovered] = useState(false);

	const activePage = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.find((p) => p.id === activePageId),
		[flows, activeFlowId, activePageId],
	);

	return (
		<div className="evy-border-b evy-border-gray evy-p-2 evy-bg-white evy-flex evy-items-center">
			<style>{focusButtonCss}</style>
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
							className="evy-text-center evy-bg-transparent evy-border-none evy-focus-visible:outline-none evy-text-lg evy-font-semibold"
							style={{ height: "var(--size-navbar-control)" }}
							aria-label="Page title"
						/>
						<button
							type="button"
							onClick={() => dispatchRow({ type: "TOGGLE_FOCUS_MODE" })}
							className={focusMode ? "evy-focus-button--active" : ""}
							style={focusBtnHovered ? focusButtonHoverStyle : focusButtonStyle}
							onMouseEnter={() => setFocusBtnHovered(true)}
							onMouseLeave={() => setFocusBtnHovered(false)}
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
