/**
 * DOM contract between phone page scroll surfaces and viewport wheel routing
 * ({@link useViewportGestures}). Keep in sync with {@link CANVAS_PAGE_INTERIOR_SELECTOR}.
 */
export const CANVAS_PAGE_INTERIOR_ATTR = "data-canvas-page-interior" as const;

export const CANVAS_PAGE_INTERIOR_SELECTOR =
	`[${CANVAS_PAGE_INTERIOR_ATTR}]` as const;

/** Spread onto the scroll root so the attribute name cannot drift from the selector. */
export const canvasPageInteriorDomProps = {
	[CANVAS_PAGE_INTERIOR_ATTR]: true,
} as const;
