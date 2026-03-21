import type { CSSProperties, ReactNode } from "react";
import { LUCIDE_STROKE_WIDTH, PARSE_ICON_REGEX } from "./iconSyntax";
import resolveIcon from "./resolveIcon";

const INLINE_ICON_STYLE: CSSProperties = {
	display: "inline-block",
	height: "1em",
	width: "1em",
	verticalAlign: "middle",
};

export default function parseIconText(input: string): ReactNode {
	const parts: ReactNode[] = [];
	let lastIndex = 0;

	for (const match of input.matchAll(PARSE_ICON_REGEX)) {
		const matchStart = match.index;
		const matchEnd = matchStart + match[0].length;
		const iconName = match[1];

		if (matchStart > lastIndex) {
			parts.push(input.slice(lastIndex, matchStart));
		}

		const IconComponent = resolveIcon(iconName);
		if (IconComponent) {
			parts.push(
				<IconComponent
					key={matchStart}
					style={INLINE_ICON_STYLE}
					aria-hidden
					strokeWidth={LUCIDE_STROKE_WIDTH}
				/>,
			);
		} else {
			parts.push(match[0]);
		}

		lastIndex = matchEnd;
	}

	if (lastIndex < input.length) {
		parts.push(input.slice(lastIndex));
	}

	return parts.length === 0 ? input : parts;
}
