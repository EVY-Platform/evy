import { useLayoutEffect, useRef, type RefObject } from "react";

import type { useCamera } from "./useCamera";
import { consumeCapturedPosition } from "../utils/preActivationCapture";

type PanToElement = ReturnType<typeof useCamera>["panToElement"];
type SnapPan = ReturnType<typeof useCamera>["snapPan"];

/**
 * When an element becomes active, compensates for any layout shift before paint
 * and then smoothly pans the canvas so the active page is centered (if needed).
 * Deactivating does not move the camera.
 *
 * Call from {@link CanvasViewport} (or any component that owns the same camera as the viewport).
 */
export function useSelectionPanOnEnter(
	isActive: boolean,
	activePageId: string | undefined,
	panToElement: PanToElement,
	snapPan: SnapPan,
	viewportRef: RefObject<HTMLDivElement | null>,
) {
	const prevIsActiveRef = useRef(isActive);

	useLayoutEffect(() => {
		const wasEntering = !prevIsActiveRef.current && isActive;
		prevIsActiveRef.current = isActive;

		if (!wasEntering || !activePageId) return;

		const escapedId =
			typeof CSS !== "undefined" && typeof CSS.escape === "function"
				? CSS.escape(activePageId)
				: activePageId;
		const el = document.querySelector(
			`[data-canvas-page-frame][data-page-id="${escapedId}"]`,
		);
		if (!(el instanceof HTMLElement)) return;

		// Read and clear the pre-activation screen center captured before dispatch.
		const preCenter = consumeCapturedPosition();

		if (preCenter) {
			// Compensate for the layout shift: snap camera so the page appears
			// at its pre-click screen position (invisible to the user).
			const postRect = el.getBoundingClientRect();
			const postCenterX = postRect.left + postRect.width / 2;
			const postCenterY = postRect.top + postRect.height / 2;

			const shiftX = preCenter.x - postCenterX;
			const shiftY = preCenter.y - postCenterY;

			if (Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5) {
				snapPan(shiftX, shiftY);
			}

			// Now smoothly pan to center if the page isn't already there.
			// panToElement has its own threshold guard so this is a no-op when centered.
			panToElement(el);
		} else {
			// No capture available (e.g. breadcrumb or URL navigation).
			// Snap directly to center without animation to avoid a visible jump.
			const viewport = viewportRef.current;
			if (!viewport) return;

			const vpRect = viewport.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();

			const dx =
				vpRect.left + vpRect.width / 2 - (elRect.left + elRect.width / 2);
			const dy =
				vpRect.top + vpRect.height / 2 - (elRect.top + elRect.height / 2);

			if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
				snapPan(dx, dy);
			}
		}
	}, [isActive, activePageId, panToElement, snapPan, viewportRef]);
}
