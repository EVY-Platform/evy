import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	ReactNode,
} from "react";
import { useCallback, useRef } from "react";

import { useCamera } from "../hooks/useCamera";
import { useFocusPanOnEnter } from "../hooks/useFocusPanOnEnter";
import { useViewportGestures } from "../hooks/useViewportGestures";
import { CameraContext } from "../state/contexts/CameraContext";

const GRID_BASE_SIZE_PX = 12;

const GRID_BACKGROUND_IMAGE = `
	radial-gradient(circle, var(--color-evy-gray-medium) 1px, transparent 1px)
`;

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

	const cam = getCamera();
	const gridSize = GRID_BASE_SIZE_PX * cam.scale;
	const gridStyle: CSSProperties = {
		backgroundColor: "var(--color-evy-light)",
		backgroundImage: GRID_BACKGROUND_IMAGE,
		backgroundSize: `${gridSize}px ${gridSize}px`,
		backgroundPosition: `${cam.offsetX}px ${cam.offsetY}px`,
		opacity: 1,
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
					style={gridStyle}
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
