import type { CSSProperties } from "react";

export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const OPACITY_MS = 350;
const opacityTransition = `opacity ${OPACITY_MS}ms ${EASE}`;

export const canvasContentStyle: CSSProperties = {
	gap: "var(--size-4)",
};

export const addPageButtonStyle: CSSProperties = {
	position: "absolute",
	bottom: "var(--size-4)",
	left: "50%",
	transform: "translateX(-50%)",
	zIndex: 15,
};

const pagePhoneFrameBase: CSSProperties = {
	overflow: "hidden",
	height: "var(--size-662)",
	width: "var(--size-336)",
	transition: opacityTransition,
};

const centeredPageFrame: CSSProperties = {
	...pagePhoneFrameBase,
	marginLeft: "auto",
	marginRight: "auto",
};

export const pageWrapperStyle: CSSProperties = {
	...centeredPageFrame,
	opacity: 1,
};

export const pageWrapperHiddenStyle: CSSProperties = {
	...centeredPageFrame,
	opacity: 0,
	pointerEvents: "none",
};

export const secondaryPageWrapperStyle: CSSProperties = {
	...pagePhoneFrameBase,
	marginLeft: "var(--size-4)",
	opacity: 1,
	transition: undefined,
};

export const panelShadowStyle: CSSProperties = {
	boxShadow: "var(--shadow-subtle)",
};

export const rightPanelStyle: CSSProperties = {
	...panelShadowStyle,
	borderLeftWidth: "1px",
	borderLeftStyle: "solid",
};

export const PANEL_WIDTH_MS = 200;

export const sidePanelWidthTransitionStyle: CSSProperties = {
	transition: `width ${PANEL_WIDTH_MS}ms ${EASE}`,
	flexShrink: 0,
};

/** Opacity fade for panel inner content after width expansion completes. */
export const PANEL_CONTENT_FADE_MS = 150;

export const panelContentFadeTransitionStyle: CSSProperties = {
	transition: `opacity ${PANEL_CONTENT_FADE_MS}ms ${EASE}`,
};

export const collapsedPanelBarStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: "100%",
	minHeight: "100%",
	flex: 1,
	backgroundColor: "var(--color-white)",
};
