import type { CSSProperties, ReactNode, RefObject } from "react";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";
import { phoneContentPadding } from "./pageStyles";

type SheetPageFrameProps = {
	children: ReactNode;
	scrollableRef: RefObject<HTMLDivElement | null>;
	className?: string;
};

const sheetOuterStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	padding: phoneContentPadding,
	marginTop: "-2px",
	marginLeft: "-2px",
	height: "100.5%",
	width: "101%",
};

const sheetPreviewPageStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	margin: phoneContentPadding,
	borderRadius: "var(--radius-2-4)",
	backgroundColor: "var(--color-white)",
};

const sheetScrimStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	margin: phoneContentPadding,
	borderRadius: "var(--radius-2-4)",
	backgroundColor: "rgba(0, 0, 0, 0.3)",
};

const sheetOverlayStyle: CSSProperties = {
	position: "absolute",
	bottom: phoneContentPadding,
	left: phoneContentPadding,
	right: phoneContentPadding,
	height: "60%",
	backgroundColor: "var(--color-white)",
	borderTopLeftRadius: "0.75rem",
	borderTopRightRadius: "0.75rem",
	borderBottomLeftRadius: "var(--radius-2-4)",
	borderBottomRightRadius: "var(--radius-2-4)",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
};

const sheetHandleStyle: CSSProperties = {
	width: "2.25rem",
	height: "0.25rem",
	borderRadius: "0.125rem",
	backgroundColor: "var(--color-evy-gray-medium)",
	margin: "0.5rem auto 0",
	flexShrink: 0,
};

const sheetContentStyle: CSSProperties = {
	flex: 1,
	overflow: "auto",
	display: "flex",
	flexDirection: "column",
};

export function SheetPageFrame({
	children,
	scrollableRef,
	className = "",
}: SheetPageFrameProps) {
	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full"
			style={{ position: "relative", padding: phoneContentPadding }}
		>
			<div
				style={sheetOuterStyle}
				{...canvasPageInteriorDomProps}
				ref={scrollableRef}
			>
				<div style={sheetPreviewPageStyle} aria-hidden />
				<div style={sheetScrimStyle} aria-hidden />
				<div style={sheetOverlayStyle}>
					<div style={sheetHandleStyle} aria-hidden />
					<div className={className} style={sheetContentStyle}>
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
