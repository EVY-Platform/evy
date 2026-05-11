import type { CSSProperties } from "react";

/** Padding between phone frame bezel and inner content area. */
export const phoneContentPadding = "var(--size-30px)";

export const rounded24Style: CSSProperties = {
	borderRadius: "var(--radius-2-4)",
};

export const baseTitleStyle: CSSProperties = {
	textAlign: "center",
	fontWeight: "var(--font-semibold)",
	fontSize: "var(--text-xl)",
	padding: "var(--size-2) var(--size-4)",
};
