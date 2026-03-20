import { type RefObject, useEffect, useState } from "react";

/**
 * Tracks whether `elementRef` intersects the browser viewport (with margin).
 * Uses `root: null` so visibility stays correct when ancestors use CSS transforms (canvas pan/zoom).
 */
export function useIntersectVisible(
	elementRef: RefObject<HTMLElement | null>,
	options: { rootMargin?: string } = {},
): boolean {
	const { rootMargin = "100%" } = options;
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				setVisible(entry.isIntersecting);
			},
			{ root: null, rootMargin },
		);

		observer.observe(element);
		return () => {
			observer.disconnect();
		};
	}, [elementRef, rootMargin]);

	return visible;
}
