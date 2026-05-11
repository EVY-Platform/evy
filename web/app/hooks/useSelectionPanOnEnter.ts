import { useLayoutEffect, useRef, type RefObject } from "react";

import type { useCamera } from "./useCamera";
import { consumeCapturedPosition } from "../utils/preActivationCapture";

type PanToElement = ReturnType<typeof useCamera>["panToElement"];
type SnapPan = ReturnType<typeof useCamera>["snapPan"];

function findPageFrame(pageId: string): HTMLElement | null {
	const escapedId = CSS.escape(pageId);
	const el = document.querySelector(
		`[data-canvas-page-frame][data-page-id="${escapedId}"]`,
	);
	return el instanceof HTMLElement ? el : null;
}

function snapToCompensate(
	preCenter: { x: number; y: number },
	el: HTMLElement,
	snapPan: SnapPan,
): void {
	const rect = el.getBoundingClientRect();
	const dx = preCenter.x - (rect.left + rect.width / 2);
	const dy = preCenter.y - (rect.top + rect.height / 2);
	if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
		snapPan(dx, dy);
	}
}

/**
 * Compensates for layout shifts when selection changes:
 * - On activate: snaps camera then smoothly pans to center the page.
 * - On deactivate: snaps camera so the page stays in place visually.
 */
export function useSelectionPanOnEnter(
	isActive: boolean,
	activePageId: string | undefined,
	panToElement: PanToElement,
	snapPan: SnapPan,
	viewportRef: RefObject<HTMLDivElement | null>,
) {
	const prevIsActiveRef = useRef(isActive);
	const prevActivePageIdRef = useRef(activePageId);
	const hasMountedRef = useRef(false);

	useLayoutEffect(() => {
		const isFirstRun = !hasMountedRef.current;
		hasMountedRef.current = true;

		const wasEntering = !prevIsActiveRef.current && isActive;
		const wasLeaving = prevIsActiveRef.current && !isActive;
		const prevPageId = prevActivePageIdRef.current;

		prevIsActiveRef.current = isActive;
		prevActivePageIdRef.current = activePageId;

		if (wasLeaving && prevPageId) {
			const preCenter = consumeCapturedPosition();
			const el = findPageFrame(prevPageId);
			if (preCenter && el) snapToCompensate(preCenter, el, snapPan);
			return;
		}

		// Center the active page on enter OR on first mount if already active.
		const shouldCenter = wasEntering || (isFirstRun && isActive);
		if (!shouldCenter || !activePageId) return;

		const el = findPageFrame(activePageId);
		if (!el) return;

		const preCenter = consumeCapturedPosition();

		if (preCenter) {
			snapToCompensate(preCenter, el, snapPan);
			panToElement(el);
		} else {
			// No capture (e.g. page refresh/URL navigation) — snap directly to center.
			const viewport = viewportRef.current;
			if (!viewport) return;
			const vpRect = viewport.getBoundingClientRect();
			const fakeCenter = {
				x: vpRect.left + vpRect.width / 2,
				y: vpRect.top + vpRect.height / 2,
			};
			snapToCompensate(fakeCenter, el, snapPan);
		}
	}, [isActive, activePageId, panToElement, snapPan, viewportRef]);
}
