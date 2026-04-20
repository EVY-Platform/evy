import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	ReactNode,
} from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import {
	type CursorPosition,
	drawDotField,
	GRID_BASE_SIZE_PX,
} from "./canvasDotField";
import { useCamera } from "../hooks/useCamera";
import { useFocusPanOnEnter } from "../hooks/useFocusPanOnEnter";
import { useViewportGestures } from "../hooks/useViewportGestures";
import { CameraContext } from "../state/contexts/CameraContext";

/** Time constant for display cursor to ease toward the pointer (~95% in this many ms). */
const CURSOR_EASE_MS = 200;

const worldStyle: CSSProperties = {
	transformOrigin: "0 0",
	willChange: "transform",
	minWidth: "100%",
	minHeight: "100%",
};

type CanvasViewportProps = {
	children: ReactNode;
	/** Called when the user clicks empty canvas (not on a page or control). */
	onBackgroundClick?: () => void;
	/** Layout styles for the horizontal row of pages (gap, justify, etc.). */
	contentStyle?: CSSProperties;
	/** When focus mode turns on, pan so this page is centered. */
	focusMode?: boolean;
	activePageId?: string;
};

export function CanvasViewport({
	children,
	onBackgroundClick,
	contentStyle,
	focusMode = false,
	activePageId,
}: CanvasViewportProps) {
	const camera = useCamera();
	const {
		viewportRef,
		worldRef,
		pan,
		panToElement,
		zoomAtScreenPoint,
		fitToBounds,
		getCamera,
	} = camera;

	useFocusPanOnEnter(focusMode, activePageId, panToElement);

	const contentMeasureRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const targetCursorRef = useRef<CursorPosition>(null);
	const displayCursorRef = useRef<CursorPosition>(null);
	const lastCursorEaseTsRef = useRef<number | null>(null);
	const camRef = useRef(getCamera());
	const disableMorphRef = useRef(false);
	const requestRepaintRef = useRef<() => void>(() => {});

	const cam = getCamera();
	camRef.current = cam;

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const syncReducedMotion = () => {
			disableMorphRef.current = mediaQuery.matches;
			requestRepaintRef.current();
		};
		disableMorphRef.current = mediaQuery.matches;
		mediaQuery.addEventListener("change", syncReducedMotion);
		return () => {
			mediaQuery.removeEventListener("change", syncReducedMotion);
		};
	}, []);

	useEffect(() => {
		const viewport = viewportRef.current;
		const canvas = canvasRef.current;
		if (!viewport || !canvas) {
			return;
		}

		let rafId: number | null = null;
		const easeTauMs = CURSOR_EASE_MS / 3;

		const paintDotField = () => {
			const cssWidth = canvas.clientWidth;
			const cssHeight = canvas.clientHeight;
			if (cssWidth <= 0 || cssHeight <= 0) {
				return;
			}

			const devicePixelRatio = window.devicePixelRatio || 1;
			canvas.width = Math.round(cssWidth * devicePixelRatio);
			canvas.height = Math.round(cssHeight * devicePixelRatio);

			const context = canvas.getContext("2d");
			if (!context) {
				return;
			}

			context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

			const style = getComputedStyle(viewport);
			const currentCam = camRef.current;
			const gridSize = GRID_BASE_SIZE_PX * currentCam.scale;

			drawDotField({
				ctx: context,
				cssWidth,
				cssHeight,
				gridSize,
				scale: currentCam.scale,
				offsetX: currentCam.offsetX,
				offsetY: currentCam.offsetY,
				cursor: displayCursorRef.current,
				backgroundColor: style.getPropertyValue("--color-evy-light").trim(),
				colorMedium: style.getPropertyValue("--color-evy-gray-medium").trim(),
				colorDark: style.getPropertyValue("--color-evy-gray-dark").trim(),
				disableMorph: disableMorphRef.current,
			});
		};

		const tick = (timeStamp: number) => {
			rafId = null;

			const target = targetCursorRef.current;
			const display = displayCursorRef.current;

			let stillAnimating = false;

			if (target === null) {
				displayCursorRef.current = null;
				lastCursorEaseTsRef.current = null;
			} else if (display === null) {
				displayCursorRef.current = { x: target.x, y: target.y };
				lastCursorEaseTsRef.current = timeStamp;
			} else {
				const lastTs = lastCursorEaseTsRef.current;
				const dt = lastTs !== null ? Math.max(0.0001, timeStamp - lastTs) : 16;
				lastCursorEaseTsRef.current = timeStamp;

				const alpha = 1 - Math.exp(-dt / easeTauMs);
				const nx = display.x + (target.x - display.x) * alpha;
				const ny = display.y + (target.y - display.y) * alpha;
				if (Math.hypot(target.x - nx, target.y - ny) < 0.1) {
					displayCursorRef.current = { x: target.x, y: target.y };
				} else {
					displayCursorRef.current = { x: nx, y: ny };
					stillAnimating = true;
				}
			}

			paintDotField();

			if (stillAnimating) {
				rafId = requestAnimationFrame(tick);
			} else {
				lastCursorEaseTsRef.current = null;
			}
		};

		const schedulePaint = () => {
			if (rafId != null) {
				return;
			}
			rafId = requestAnimationFrame(tick);
		};

		requestRepaintRef.current = schedulePaint;

		const resizeObserver = new ResizeObserver(() => {
			schedulePaint();
		});
		resizeObserver.observe(viewport);

		const onMove = (event: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			targetCursorRef.current = {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			};
			schedulePaint();
		};

		const onLeave = () => {
			targetCursorRef.current = null;
			displayCursorRef.current = null;
			lastCursorEaseTsRef.current = null;
			schedulePaint();
		};

		viewport.addEventListener("mousemove", onMove);
		viewport.addEventListener("mouseleave", onLeave);

		schedulePaint();

		return () => {
			resizeObserver.disconnect();
			viewport.removeEventListener("mousemove", onMove);
			viewport.removeEventListener("mouseleave", onLeave);
			requestRepaintRef.current = () => {};
			if (rafId != null) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [viewportRef]);

	// Repaint when camera pan/zoom changes (canvas reads camRef; effect deps tie to camera state).
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional — schedule paint on camera updates
	useLayoutEffect(() => {
		requestRepaintRef.current();
	}, [cam.offsetX, cam.offsetY, cam.scale]);

	const handleFitToView = useCallback(() => {
		const content = contentMeasureRef.current;
		if (!content) return;
		const width = content.offsetWidth;
		const height = content.offsetHeight;
		if (width <= 0 || height <= 0) return;
		fitToBounds({ x: 0, y: 0, width, height });
	}, [fitToBounds]);

	useViewportGestures({
		viewportRef,
		pan,
		zoomAtScreenPoint,
		getCamera,
		fitToView: handleFitToView,
	});

	const handleBackgroundLayerClick = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			if (event.target === event.currentTarget) {
				onBackgroundClick?.();
			}
		},
		[onBackgroundClick],
	);

	return (
		<CameraContext.Provider value={camera}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Canvas viewport clears selection on empty click */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Mouse-only canvas interaction */}
			<div
				ref={viewportRef}
				data-testid="canvas-viewport"
				className="evy-relative evy-flex-1 evy-min-h-0 evy-overflow-hidden evy-p-4"
				onClick={handleBackgroundLayerClick}
			>
				<canvas
					ref={canvasRef}
					className="evy-pointer-events-none evy-absolute evy-inset-0 evy-block evy-h-full evy-w-full"
					data-canvas-grid
					aria-hidden
				/>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Transformed world layer hit target */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: Mouse-only canvas interaction */}
				<div
					ref={worldRef}
					className="evy-relative evy-inline-flex evy-flex-row evy-flex-shrink-0 evy-gap-4"
					style={worldStyle}
					onClick={handleBackgroundLayerClick}
				>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: Page row background hit target */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: Mouse-only canvas interaction */}
					<div
						ref={contentMeasureRef}
						className="evy-relative evy-flex evy-flex-row evy-flex-shrink-0 evy-gap-4"
						style={{ ...contentStyle, zIndex: 10 }}
						onClick={handleBackgroundLayerClick}
					>
						{children}
					</div>
				</div>
			</div>
		</CameraContext.Provider>
	);
}
