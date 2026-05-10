/**
 * Module-level store for capturing a page frame's screen-space center
 * BEFORE a state change moves it in the DOM. This allows useSelectionPanOnEnter
 * to compensate for layout shifts before the browser paints.
 */

let capturedCenter: { x: number; y: number } | null = null;

/**
 * Captures the screen-space center of a page frame element identified by pageId.
 * Call this BEFORE dispatching SET_ACTIVE_PAGE so the position is available
 * in the subsequent useLayoutEffect.
 */
export function capturePageFramePosition(pageId: string): void {
	const escapedId =
		typeof CSS !== "undefined" && typeof CSS.escape === "function"
			? CSS.escape(pageId)
			: pageId;
	const el = document.querySelector(
		`[data-canvas-page-frame][data-page-id="${escapedId}"]`,
	);
	if (el) {
		const rect = el.getBoundingClientRect();
		capturedCenter = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		};
	}
}

/**
 * Returns and clears the previously captured position.
 * Returns null if no position was captured.
 */
export function consumeCapturedPosition(): { x: number; y: number } | null {
	const pos = capturedCenter;
	capturedCenter = null;
	return pos;
}
