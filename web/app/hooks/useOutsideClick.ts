import { useEffect } from "react";

/** Invokes onOutside for mousedown events outside the caller's containers while active. */
export function useOutsideClick(
	active: boolean,
	isInside: (target: Node) => boolean,
	onOutside: () => void,
): void {
	useEffect(() => {
		if (!active) return;
		const handlePointerDown = (event: MouseEvent) => {
			if (isInside(event.target as Node)) return;
			onOutside();
		};
		document.addEventListener("mousedown", handlePointerDown);
		return () =>
			document.removeEventListener("mousedown", handlePointerDown);
	}, [active, isInside, onOutside]);
}
