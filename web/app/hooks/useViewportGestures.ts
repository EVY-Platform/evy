import type { RefObject } from "react";
import { useEffect } from "react";

import type { CameraState } from "./useCamera";
import type { ScreenPoint } from "../utils/coordinates";

/** Ctrl/trackpad zoom: `exp(-deltaY * sensitivity)` */
const WHEEL_ZOOM_SENSITIVITY = 0.002;
const MIN_PAN_SPEED_FOR_INERTIA = 0.2;
const INERTIA_MULTIPLIER = 14;
const INERTIA_DECAY = 0.88;
const INERTIA_STOP_THRESHOLD = 0.4;

function viewportLocalPoint(
	viewport: HTMLElement,
	clientX: number,
	clientY: number,
): ScreenPoint {
	const rect = viewport.getBoundingClientRect();
	return { x: clientX - rect.left, y: clientY - rect.top };
}

type UseViewportGesturesOptions = {
	viewportRef: RefObject<HTMLDivElement | null>;
	pan: (dx: number, dy: number) => void;
	zoomAtScreenPoint: (point: ScreenPoint, scale: number) => void;
	getCamera: () => CameraState;
	fitToView: () => void;
};

/**
 * Wires wheel zoom, middle-button pan (with inertia), Safari pinch zoom, and Cmd/Ctrl+0 fit-to-view.
 */
export function useViewportGestures({
	viewportRef,
	pan,
	zoomAtScreenPoint,
	getCamera,
	fitToView,
}: UseViewportGesturesOptions): void {
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;

		const isInsidePageFrame = (target: EventTarget | null): boolean => {
			if (!(target instanceof Element)) return false;
			const frame = target.closest("[data-canvas-page-frame]");
			return frame !== null && viewport.contains(frame);
		};

		const onWheel = (event: WheelEvent) => {
			const { x: localX, y: localY } = viewportLocalPoint(
				viewport,
				event.clientX,
				event.clientY,
			);

			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
				const nextScale = getCamera().scale * factor;
				zoomAtScreenPoint({ x: localX, y: localY }, nextScale);
				return;
			}

			if (isInsidePageFrame(event.target)) {
				return;
			}

			event.preventDefault();
			pan(-event.deltaX, -event.deltaY);
		};

		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			viewport.removeEventListener("wheel", onWheel);
		};
	}, [getCamera, pan, viewportRef, zoomAtScreenPoint]);

	/** Middle-button pan with inertial decay on release. */
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;

		let lastX = 0;
		let lastY = 0;
		let lastT = 0;
		let velX = 0;
		let velY = 0;
		let inertiaRaf: number | null = null;
		let activePointerId: number | null = null;

		const stopInertia = () => {
			if (inertiaRaf !== null) {
				cancelAnimationFrame(inertiaRaf);
				inertiaRaf = null;
			}
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 1) return;
			event.preventDefault();
			stopInertia();
			activePointerId = event.pointerId;
			viewport.setPointerCapture(event.pointerId);
			lastX = event.clientX;
			lastY = event.clientY;
			lastT = performance.now();
			velX = 0;
			velY = 0;
		};

		const onPointerMove = (event: PointerEvent) => {
			if (activePointerId !== event.pointerId) return;
			const now = performance.now();
			const dt = Math.max(now - lastT, 1);
			const dx = event.clientX - lastX;
			const dy = event.clientY - lastY;
			velX = dx / dt;
			velY = dy / dt;
			lastX = event.clientX;
			lastY = event.clientY;
			lastT = now;
			pan(dx, dy);
		};

		const endPan = (event: PointerEvent) => {
			if (activePointerId !== event.pointerId) return;
			if (event.type !== "pointercancel" && event.button !== 1) return;
			activePointerId = null;
			try {
				viewport.releasePointerCapture(event.pointerId);
			} catch {
				// ignore
			}

			const speed = Math.hypot(velX, velY);
			if (speed < MIN_PAN_SPEED_FOR_INERTIA) return;

			let vx = velX * INERTIA_MULTIPLIER;
			let vy = velY * INERTIA_MULTIPLIER;
			const decay = INERTIA_DECAY;

			const tick = () => {
				vx *= decay;
				vy *= decay;
				if (Math.hypot(vx, vy) < INERTIA_STOP_THRESHOLD) {
					inertiaRaf = null;
					return;
				}
				pan(vx, vy);
				inertiaRaf = requestAnimationFrame(tick);
			};
			inertiaRaf = requestAnimationFrame(tick);
		};

		viewport.addEventListener("pointerdown", onPointerDown);
		viewport.addEventListener("pointermove", onPointerMove);
		viewport.addEventListener("pointerup", endPan);
		viewport.addEventListener("pointercancel", endPan);

		return () => {
			stopInertia();
			viewport.removeEventListener("pointerdown", onPointerDown);
			viewport.removeEventListener("pointermove", onPointerMove);
			viewport.removeEventListener("pointerup", endPan);
			viewport.removeEventListener("pointercancel", endPan);
		};
	}, [pan, viewportRef]);

	/** Safari trackpad pinch zoom */
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;

		let baseScale = 1;

		const onGestureStart = (event: Event) => {
			event.preventDefault();
			baseScale = getCamera().scale;
		};

		const onGestureChange = (event: Event) => {
			event.preventDefault();
			const ge = event as unknown as {
				scale: number;
				clientX: number;
				clientY: number;
			};
			const { x: localX, y: localY } = viewportLocalPoint(
				viewport,
				ge.clientX,
				ge.clientY,
			);
			zoomAtScreenPoint({ x: localX, y: localY }, baseScale * ge.scale);
		};

		viewport.addEventListener("gesturestart", onGestureStart);
		viewport.addEventListener("gesturechange", onGestureChange);

		return () => {
			viewport.removeEventListener("gesturestart", onGestureStart);
			viewport.removeEventListener("gesturechange", onGestureChange);
		};
	}, [getCamera, viewportRef, zoomAtScreenPoint]);

	/** Fit all content: Cmd/Ctrl + 0 */
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "0") {
				event.preventDefault();
				fitToView();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [fitToView]);
}
