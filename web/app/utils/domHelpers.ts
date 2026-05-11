/**
 * Queries a page frame element by its page ID.
 */
export function findPageFrame(pageId: string): HTMLElement | null {
	const escapedId = CSS.escape(pageId);
	const el = document.querySelector(
		`[data-canvas-page-frame][data-page-id="${escapedId}"]`,
	);
	return el instanceof HTMLElement ? el : null;
}

/**
 * Returns the screen-space center of an element.
 */
export function getElementCenter(el: HTMLElement): { x: number; y: number } {
	const rect = el.getBoundingClientRect();
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	};
}
