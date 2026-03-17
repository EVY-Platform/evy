import type { CSSProperties } from "react";
import iconMap from "../../icons/iconMap";

const ICON_SYNTAX_REGEX = /^::(.+)::$/;

const leftPositionStyle: CSSProperties = {
	insetInlineStart: 0,
	paddingInlineStart: "var(--spacing-2)",
};

const rightPositionStyle: CSSProperties = {
	insetInlineEnd: 0,
	paddingInlineEnd: "var(--spacing-2)",
};

function resolveIconSrc(icon: string): string {
	const match = icon.match(ICON_SYNTAX_REGEX);
	if (match) {
		return iconMap[match[1]] ?? icon;
	}
	return icon;
}

export default function InlineIcon({
	icon,
	alt,
	position = "left",
}: {
	icon: string;
	alt: string;
	position?: "left" | "right";
}) {
	return (
		<div
			className="evy-absolute evy-inset-y-0 evy-flex evy-items-center evy-pointer-events-none"
			style={position === "right" ? rightPositionStyle : leftPositionStyle}
		>
			<img className="evy-h-4" src={resolveIconSrc(icon)} alt={alt} />
		</div>
	);
}
