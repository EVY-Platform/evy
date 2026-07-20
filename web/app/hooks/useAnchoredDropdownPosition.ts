import { type RefObject, useCallback, useState } from "react";

export type DropdownPosition = {
	top: number;
	left: number;
	width: number;
};

/** Fixed-position placement for a portal dropdown anchored under an element. */
export function useAnchoredDropdownPosition<T extends HTMLElement>(
	anchorRef: RefObject<T | null>,
) {
	const [position, setPosition] = useState<DropdownPosition | null>(null);

	const updatePosition = useCallback(() => {
		const anchor = anchorRef.current;
		if (!anchor) return;
		const rect = anchor.getBoundingClientRect();
		setPosition({
			top: rect.bottom + 2,
			left: rect.left,
			width: Math.max(rect.width, 160),
		});
	}, [anchorRef]);

	return { position, setPosition, updatePosition };
}
