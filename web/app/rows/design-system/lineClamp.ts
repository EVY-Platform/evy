import type { CSSProperties } from "react";

export function lineClampStyle(lines: number): CSSProperties {
	return {
		display: "-webkit-box",
		WebkitLineClamp: lines,
		WebkitBoxOrient: "vertical",
		overflow: "hidden",
		overflowWrap: "anywhere",
		wordBreak: "break-word",
	};
}
