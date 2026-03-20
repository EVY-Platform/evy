import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";

import { useIntersectVisible } from "../hooks/useIntersectVisible";

type CanvasPageFrameProps = {
	wrapperStyle: CSSProperties;
	className: string;
	children: ReactNode;
	/** Set for flow pages so focus mode can pan the camera to this frame. */
	pageId?: string;
	"data-testid"?: string;
};

/**
 * Phone-frame wrapper that may unmount inner content when off-canvas for performance.
 */
export function CanvasPageFrame({
	wrapperStyle,
	className,
	children,
	pageId,
	"data-testid": dataTestId,
}: CanvasPageFrameProps) {
	const frameRef = useRef<HTMLDivElement | null>(null);
	const visible = useIntersectVisible(frameRef, { rootMargin: "100%" });

	return (
		<div
			ref={frameRef}
			data-canvas-page-frame
			data-page-id={pageId}
			className={className}
			data-testid={dataTestId}
			style={{
				...wrapperStyle,
				contain: "layout style paint",
			}}
		>
			{visible ? (
				children
			) : (
				<div
					className="evy-h-full evy-w-full evy-box-sizing-border"
					style={{ minHeight: "var(--size-662)" }}
					aria-hidden
				/>
			)}
		</div>
	);
}
