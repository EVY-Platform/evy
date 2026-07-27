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

import { findPageFrame, getElementCenter } from "./domHelpers";

let capturedCenter: { x: number; y: number } | null = null;

/**
 * Captures the screen-space center of a page frame element identified by pageId.
 * Call this BEFORE dispatching a selection change so the position is available
 * in the subsequent useLayoutEffect.
 */
export function capturePageFramePosition(pageId: string): void {
	const el = findPageFrame(pageId);
	if (el) {
		capturedCenter = getElementCenter(el);
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

/**
 * Same as capturePageFramePosition, but for nested rows that don't know
 * their pageId — resolves the enclosing page frame from the DOM instead.
 */
export function capturePageFrameForElement(element: Element): void {
	const el = element.closest("[data-canvas-page-frame][data-page-id]");
	if (el instanceof HTMLElement) {
		capturedCenter = getElementCenter(el);
	}
}
