/** Grid spacing in CSS pixels at scale 1.0 (matches prior CSS background). */
export const GRID_BASE_SIZE_PX = 12;

export const MORPH_RADIUS_PX = 100;
/** Max shift as a fraction of `gridSize` when falloff is 1. */
export const MORPH_STRENGTH = 0.45;
export const DOT_BASE_RADIUS = 1;
export const DOT_HOVER_RADIUS = 1.4;

export type CursorPosition = { x: number; y: number } | null;

export type DrawDotFieldParams = {
	ctx: CanvasRenderingContext2D;
	cssWidth: number;
	cssHeight: number;
	gridSize: number;
	scale: number;
	offsetX: number;
	offsetY: number;
	cursor: CursorPosition;
	backgroundColor: string;
	colorMedium: string;
	colorDark: string;
	disableMorph: boolean;
};

/** Interpolate theme colors (oklch / CSS Color 4) for canvas fill. */
function mixDotColor(medium: string, dark: string, t: number): string {
	const u = Math.min(1, Math.max(0, t));
	if (u <= 0) {
		return medium;
	}
	if (u >= 1) {
		return dark;
	}
	return `color-mix(in oklch, ${medium}, ${dark} ${u * 100}%)`;
}

/**
 * Paints the dotted canvas background in CSS pixel space.
 * Caller must set `ctx` transform so one unit = one CSS px (e.g. scale by 1/dpr after sizing buffer).
 */
export function drawDotField(params: DrawDotFieldParams): void {
	const {
		ctx,
		cssWidth,
		cssHeight,
		gridSize,
		scale,
		offsetX,
		offsetY,
		cursor,
		backgroundColor,
		colorMedium,
		colorDark,
		disableMorph,
	} = params;

	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, cssWidth, cssHeight);

	if (gridSize <= 0 || cssWidth <= 0 || cssHeight <= 0 || scale <= 0) {
		return;
	}

	const dotBaseRadius = DOT_BASE_RADIUS * scale;
	const dotHoverRadius = DOT_HOVER_RADIUS * scale;
	/** Fixed in CSS px so zoom changes how many grid cells fall inside the radius. */
	const morphRadius = MORPH_RADIUS_PX;

	const half = gridSize / 2;
	const iStart = Math.ceil((0 - offsetX - half) / gridSize);
	const iEnd = Math.floor((cssWidth - offsetX - half) / gridSize);
	const jStart = Math.ceil((0 - offsetY - half) / gridSize);
	const jEnd = Math.floor((cssHeight - offsetY - half) / gridSize);

	const cursorX = cursor?.x ?? Number.POSITIVE_INFINITY;
	const cursorY = cursor?.y ?? Number.POSITIVE_INFINITY;
	const hasCursor = cursor !== null;

	const R = morphRadius;

	for (let j = jStart; j <= jEnd; j++) {
		for (let i = iStart; i <= iEnd; i++) {
			const baseX = offsetX + i * gridSize + half;
			const baseY = offsetY + j * gridSize + half;

			let colorInfluence = 0;
			let pullInfluence = 0;
			let dx = 0;
			let dy = 0;
			let d = 0;
			if (hasCursor) {
				dx = cursorX - baseX;
				dy = cursorY - baseY;
				d = Math.hypot(dx, dy);
				if (d < R) {
					const t = d / R;
					const oneMinusT = 1 - t;
					colorInfluence = oneMinusT * oneMinusT;
					pullInfluence = Math.sin(Math.PI * t);
				}
			}

			let drawX = baseX;
			let drawY = baseY;
			if (!disableMorph && hasCursor && pullInfluence > 0 && d > 1e-6) {
				const pull = pullInfluence * MORPH_STRENGTH * gridSize;
				drawX += (dx / d) * pull;
				drawY += (dy / d) * pull;
			}

			const colorT = Math.sqrt(colorInfluence);
			ctx.fillStyle = mixDotColor(colorMedium, colorDark, colorT);

			const radius =
				dotBaseRadius + (dotHoverRadius - dotBaseRadius) * colorInfluence;
			ctx.beginPath();
			ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}
