/** Collapsed side-panel width (px) overlaying the canvas edges (--size-nav-bar). */
export const COLLAPSED_PANEL_WIDTH_PX = 50;

/** Breathing room so the leftmost page clears the collapsed panel edge. */
export const CANVAS_EDGE_MARGIN_PX = 16;

type HorizontalCenterInput = {
	viewportLeft: number;
	viewportWidth: number;
	contentLeft: number;
	contentWidth: number;
};

/**
 * Horizontal pan delta so the page row is centered when it fits within the
 * safe area between collapsed side panels, or left-aligned just past the left
 * panel when it overflows (so the leftmost page is never hidden behind it).
 */
export function horizontalCenterOffset({
	viewportLeft,
	viewportWidth,
	contentLeft,
	contentWidth,
}: HorizontalCenterInput): number {
	const inset = COLLAPSED_PANEL_WIDTH_PX + CANVAS_EDGE_MARGIN_PX;
	const safeWidth = viewportWidth - inset * 2;
	const fits = contentWidth <= safeWidth;
	const desiredLeft = fits
		? viewportLeft + (viewportWidth - contentWidth) / 2
		: viewportLeft + inset;
	return desiredLeft - contentLeft;
}
