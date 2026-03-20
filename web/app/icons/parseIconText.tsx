import type { ReactNode } from "react";
import { LUCIDE_STROKE_WIDTH, PARSE_ICON_REGEX } from "./iconSyntax";
import resolveIcon from "./resolveIcon";

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
					className="evy-inline-icon"
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
