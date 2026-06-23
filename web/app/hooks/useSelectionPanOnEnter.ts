import { type RefObject, useLayoutEffect, useRef } from "react";
import { findPageFrame, getElementCenter } from "../utils/domHelpers";
import { consumeCapturedPosition } from "../utils/preActivationCapture";
import type { useCamera } from "./useCamera";

type PanToElement = ReturnType<typeof useCamera>["panToElement"];
type SnapPan = ReturnType<typeof useCamera>["snapPan"];

function snapToCompensate(
	preCenter: { x: number; y: number },
	el: HTMLElement,
	snapPan: SnapPan,
): void {
	const center = getElementCenter(el);
	const dx = preCenter.x - center.x;
	const dy = preCenter.y - center.y;
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
