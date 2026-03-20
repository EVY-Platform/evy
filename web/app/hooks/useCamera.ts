import { useCallback, useReducer, useRef, useEffect } from "react";

import type { ScreenPoint } from "../utils/coordinates";

import { EASE } from "../appLayoutStyles";

export const CAMERA_MIN_SCALE = 0.25;
export const CAMERA_MAX_SCALE = 2;

const SMOOTH_PAN_MS = 350;

export type CameraState = {
	offsetX: number;
	offsetY: number;
	scale: number;
};

type FitBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function clampScale(scale: number): number {
	return Math.min(CAMERA_MAX_SCALE, Math.max(CAMERA_MIN_SCALE, scale));
}

export function useCamera() {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const worldRef = useRef<HTMLDivElement | null>(null);
	const cameraRef = useRef<CameraState>({
		offsetX: 0,
		offsetY: 0,
		scale: 1,
	});

	const [, bumpUi] = useReducer((count: number) => count + 1, 0);

	const rafTransformId = useRef<number | null>(null);
	const smoothPanCleanupTimeoutId = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);

	const notify = useCallback(() => {
		bumpUi();
	}, []);

	const applyTransform = useCallback(() => {
		const world = worldRef.current;
		if (!world) return;
		const { offsetX, offsetY, scale } = cameraRef.current;
		// Apply pan/zoom via transform on the canvas world layer (GPU-friendly).
		// Use translate3d for compositing; preserve z-axis for correct stacking with overlays.
		world.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
	}, []);

	const scheduleTransform = useCallback(() => {
		if (rafTransformId.current !== null) return;
		rafTransformId.current = requestAnimationFrame(() => {
			rafTransformId.current = null;
			applyTransform();
		});
	}, [applyTransform]);

	const smoothPanTo = useCallback(
		(nextOffsetX: number, nextOffsetY: number) => {
			const world = worldRef.current;
			if (!world) return;

			if (smoothPanCleanupTimeoutId.current !== null) {
				clearTimeout(smoothPanCleanupTimeoutId.current);
				smoothPanCleanupTimeoutId.current = null;
			}

			if (rafTransformId.current !== null) {
				cancelAnimationFrame(rafTransformId.current);
				rafTransformId.current = null;
			}

			world.style.transition = `transform ${SMOOTH_PAN_MS}ms ${EASE}`;
			cameraRef.current.offsetX = nextOffsetX;
			cameraRef.current.offsetY = nextOffsetY;
			applyTransform();
			notify();

			smoothPanCleanupTimeoutId.current = setTimeout(() => {
				world.style.transition = "";
				smoothPanCleanupTimeoutId.current = null;
			}, SMOOTH_PAN_MS);
		},
		[applyTransform, notify],
	);

	const panToElement = useCallback(
		(element: HTMLElement) => {
			const viewport = viewportRef.current;
			if (!viewport) return;

			const vpRect = viewport.getBoundingClientRect();
			const elRect = element.getBoundingClientRect();

			const vpCenterX = vpRect.left + vpRect.width / 2;
			const vpCenterY = vpRect.top + vpRect.height / 2;
			const elCenterX = elRect.left + elRect.width / 2;
			const elCenterY = elRect.top + elRect.height / 2;

			const deltaX = vpCenterX - elCenterX;
			const deltaY = vpCenterY - elCenterY;

			const cur = cameraRef.current;
			smoothPanTo(cur.offsetX + deltaX, cur.offsetY + deltaY);
		},
		[smoothPanTo],
	);

	const getCamera = useCallback(
		(): CameraState => ({ ...cameraRef.current }),
		[],
	);

	const pan = useCallback(
		(dx: number, dy: number) => {
			cameraRef.current.offsetX += dx;
			cameraRef.current.offsetY += dy;
			scheduleTransform();
			notify();
		},
		[notify, scheduleTransform],
	);

	const zoomAtScreenPoint = useCallback(
		(screenPoint: ScreenPoint, nextScale: number) => {
			const clamped = clampScale(nextScale);
			const old = cameraRef.current;
			const worldX = (screenPoint.x - old.offsetX) / old.scale;
			const worldY = (screenPoint.y - old.offsetY) / old.scale;

			old.scale = clamped;
			old.offsetX = screenPoint.x - worldX * clamped;
			old.offsetY = screenPoint.y - worldY * clamped;

			scheduleTransform();
			notify();
		},
		[notify, scheduleTransform],
	);

	const setScaleCenterViewport = useCallback(
		(nextScale: number) => {
			const viewport = viewportRef.current;
			if (!viewport) return;
			const rect = viewport.getBoundingClientRect();
			zoomAtScreenPoint({ x: rect.width / 2, y: rect.height / 2 }, nextScale);
		},
		[zoomAtScreenPoint],
	);

	const resetView = useCallback(() => {
		cameraRef.current = { offsetX: 0, offsetY: 0, scale: 1 };
		scheduleTransform();
		notify();
	}, [notify, scheduleTransform]);

	const fitToBounds = useCallback(
		(bounds: FitBounds, paddingPx = 48) => {
			const viewport = viewportRef.current;
			if (!viewport) return;

			const vw = viewport.clientWidth;
			const vh = viewport.clientHeight;
			if (vw <= 0 || vh <= 0 || bounds.width <= 0 || bounds.height <= 0) {
				return;
			}

			const availableW = vw - paddingPx * 2;
			const availableH = vh - paddingPx * 2;
			const scaleX = availableW / bounds.width;
			const scaleY = availableH / bounds.height;
			const nextScale = clampScale(Math.min(scaleX, scaleY, CAMERA_MAX_SCALE));

			const scaledW = bounds.width * nextScale;
			const scaledH = bounds.height * nextScale;
			const offsetX = (vw - scaledW) / 2 - bounds.x * nextScale;
			const offsetY = (vh - scaledH) / 2 - bounds.y * nextScale;

			cameraRef.current = {
				offsetX,
				offsetY,
				scale: nextScale,
			};
			scheduleTransform();
			notify();
		},
		[notify, scheduleTransform],
	);

	useEffect(() => {
		applyTransform();
		return () => {
			if (smoothPanCleanupTimeoutId.current !== null) {
				clearTimeout(smoothPanCleanupTimeoutId.current);
				smoothPanCleanupTimeoutId.current = null;
			}
		};
	}, [applyTransform]);

	const zoomPercent = Math.round(cameraRef.current.scale * 100);

	return {
		viewportRef,
		worldRef,
		getCamera,
		pan,
		panToElement,
		zoomAtScreenPoint,
		setScaleCenterViewport,
		resetView,
		fitToBounds,
		zoomPercent,
	};
}
