import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	ReactNode,
} from "react";
import { useCallback, useEffect, useRef } from "react";

import { useCamera } from "../hooks/useCamera";
import { CameraContext } from "../state/contexts/CameraContext";
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

const gridBackgroundStyle: CSSProperties = {
	backgroundImage: `
		linear-gradient(to right, var(--color-gray-border) 1px, transparent 1px),
		linear-gradient(to bottom, var(--color-gray-border) 1px, transparent 1px)
	`,
	backgroundSize: "24px 24px",
	opacity: 0.35,
};

type CanvasViewportProps = {
	children: ReactNode;
	/** Called when the user clicks empty canvas (not on a page or control). */
	onBackgroundClick?: () => void;
	/** Layout styles for the horizontal row of pages (gap, justify, etc.). */
	contentStyle?: CSSProperties;
};


export function CanvasViewport({
	children,
	onBackgroundClick,
	contentStyle,
}: CanvasViewportProps) {
	const camera = useCamera();
	const {
		viewportRef,
		worldRef,
		pan,
		zoomAtScreenPoint,
		fitToBounds,
		getCamera,
	} = camera;

	const contentMeasureRef = useRef<HTMLDivElement | null>(null);

	const handleFitToView = useCallback(() => {
		const content = contentMeasureRef.current;
		if (!content) return;
		const width = content.offsetWidth;
		const height = content.offsetHeight;
		if (width <= 0 || height <= 0) return;
		fitToBounds({ x: 0, y: 0, width, height });
	}, [fitToBounds]);

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
				handleFitToView();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [handleFitToView]);

	const handleBackgroundLayerClick = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			if (event.target === event.currentTarget) {
				onBackgroundClick?.();
			}
		},
		[onBackgroundClick],
	);

	const worldStyle: CSSProperties = {
		transformOrigin: "0 0",
		willChange: "transform",
		minWidth: "100%",
		minHeight: "100%",
	};

	const cam = getCamera();
	const gridSize = 24 * cam.scale;
	const infiniteGridStyle: CSSProperties = {
		...gridBackgroundStyle,
		backgroundSize: `${gridSize}px ${gridSize}px`,
		backgroundPosition: `${cam.offsetX}px ${cam.offsetY}px`,
		zIndex: 0,
	};

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
				<div
					className="evy-pointer-events-none evy-absolute evy-inset-0"
					style={infiniteGridStyle}
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
				{/* Future: overlays (selection chrome) in screen space */}
				<div
					className="evy-pointer-events-none evy-absolute evy-inset-0"
					style={{ zIndex: 20 }}
					aria-hidden
				/>
			</div>
		</CameraContext.Provider>
	);
}
