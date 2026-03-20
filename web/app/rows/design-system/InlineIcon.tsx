import type { CSSProperties } from "react";
import {
	FULL_ICON_TOKEN_REGEX,
	LUCIDE_STROKE_WIDTH,
} from "../../icons/iconSyntax";
import resolveIcon from "../../icons/resolveIcon";

const positionStyles: Record<"left" | "right", CSSProperties> = {
	left: { insetInlineStart: 0, paddingInlineStart: "var(--size-2)" },
	right: { insetInlineEnd: 0, paddingInlineEnd: "var(--size-2)" },
};

export default function InlineIcon({
	icon,
	alt,
	position = "left",
}: {
	icon: string;
	alt: string;
	position?: "left" | "right";
}) {
	const match = icon.match(FULL_ICON_TOKEN_REGEX);
	const IconComponent = match ? resolveIcon(match[1]) : undefined;
	if (!IconComponent) return null;

	return (
		<div
			className="evy-absolute evy-inset-y-0 evy-flex evy-items-center evy-pointer-events-none"
			style={positionStyles[position]}
		>
			<IconComponent
				className="evy-h-4 evy-w-4"
				size={16}
				strokeWidth={LUCIDE_STROKE_WIDTH}
				role="img"
				aria-label={alt}
			/>
		</div>
	);
}
