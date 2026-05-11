/**
 * Module-level store for capturing a page frame's screen-space center
 * BEFORE a state change moves it in the DOM. This allows useSelectionPanOnEnter
 * to compensate for layout shifts before the browser paints.
 *
 * Module-level state is intentional here: the position must be captured
 * synchronously during a React event handler (before dispatch) and consumed
 * in a subsequent useLayoutEffect. Passing it through React state would
 * miss the synchronous dispatch-to-effect window. The set/consume/clear
 * cycle is always fully synchronous within a single render pass.
 */

let capturedCenter: { x: number; y: number } | null = null;

/**
 * Captures the screen-space center of a page frame element identified by pageId.
 * Call this BEFORE dispatching a selection change so the position is available
 * in the subsequent useLayoutEffect.
 */
export function capturePageFramePosition(pageId: string): void {
	const el = document.querySelector(
		`[data-canvas-page-frame][data-page-id="${CSS.escape(pageId)}"]`,
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
 */
export function consumeCapturedPosition(): { x: number; y: number } | null {
	const pos = capturedCenter;
	capturedCenter = null;
	return pos;
}
