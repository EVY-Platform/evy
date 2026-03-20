import type { CSSProperties } from "react";

export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const OPACITY_MS = 350;
const opacityTransition = `opacity ${OPACITY_MS}ms ${EASE}`;

export const canvasContentStyle: CSSProperties = {
	gap: "var(--size-4)",
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

const secondaryPageFrameBase: CSSProperties = {
	...pagePhoneFrameBase,
	marginLeft: "var(--size-4)",
};

export const secondaryPageWrapperStyle: CSSProperties = {
	...secondaryPageFrameBase,
	opacity: 1,
};

export const secondaryPageWrapperHiddenStyle: CSSProperties = {
	...secondaryPageFrameBase,
	opacity: 0,
	pointerEvents: "none",
};

export const panelShadowStyle: CSSProperties = {
	boxShadow: "var(--shadow-subtle)",
};

export const rightPanelStyle: CSSProperties = {
	...panelShadowStyle,
	borderLeftWidth: "1px",
	borderLeftStyle: "solid",
};
