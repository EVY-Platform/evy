import { useEffect, useRef } from "react";

import type { useCamera } from "./useCamera";

type PanToElement = ReturnType<typeof useCamera>["panToElement"];

/**
 * When focus mode turns on, smoothly pans the canvas so the active page is centered.
 * Exiting focus mode does not move the camera.
 *
 * Call from {@link CanvasViewport} (or any component that owns the same `panToElement` as the viewport).
 */
export function useFocusPanOnEnter(
	focusMode: boolean,
	activePageId: string | undefined,
	panToElement: PanToElement,
) {
	const prevFocusModeRef = useRef(focusMode);

	useEffect(() => {
		const wasEntering = !prevFocusModeRef.current && focusMode;
		prevFocusModeRef.current = focusMode;

		if (!wasEntering || !activePageId) return;

		let cancelled = false;

		const run = () => {
			if (cancelled) return;
			const escapedId =
				typeof CSS !== "undefined" && typeof CSS.escape === "function"
					? CSS.escape(activePageId)
					: activePageId;
			const el = document.querySelector(
				`[data-canvas-page-frame][data-page-id="${escapedId}"]`,
			);
			if (el instanceof HTMLElement) {
				panToElement(el);
			}
		};

		// Wait for layout after React commit so bounds match the new focus layout.
		const rafId = requestAnimationFrame(run);

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
		};
	}, [focusMode, activePageId, panToElement]);
}
