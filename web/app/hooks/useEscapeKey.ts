import { useEffect } from "react";

/** Registers a document-level Escape key listener while `enabled` is true. */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
	useEffect(() => {
		if (!enabled) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onEscape();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onEscape, enabled]);
}
