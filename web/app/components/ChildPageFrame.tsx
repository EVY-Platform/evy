import type { RefObject, ReactNode } from "react";

import { rounded24Style } from "./pageStyles";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";

type ChildPageFrameProps = {
	children: ReactNode;
	scrollableRef: RefObject<HTMLDivElement | null>;
	className?: string;
};

export function ChildPageFrame({
	children,
	scrollableRef,
	className = "",
}: ChildPageFrameProps) {
	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--size-30px)" }}
		>
			<div
				className={`evy-overflow-scroll evy-flex evy-flex-col evy-h-full evy-bg-white${className ? ` ${className}` : ""}`}
				style={rounded24Style}
				{...canvasPageInteriorDomProps}
				ref={scrollableRef}
			>
				{children}
			</div>
		</div>
	);
}
