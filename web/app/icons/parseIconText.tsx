import type { ReactNode } from "react";
import iconMap from "./iconMap";

const ICON_REGEX = /::[a-zA-Z.]+::/g;

export default function parseIconText(input: string): ReactNode {
	const parts: ReactNode[] = [];
	let lastIndex = 0;

	for (const match of input.matchAll(ICON_REGEX)) {
		const matchStart = match.index;
		const matchEnd = matchStart + match[0].length;

		if (matchStart > lastIndex) {
			parts.push(input.slice(lastIndex, matchStart));
		}

		const iconName = match[0].slice(2, -2);
		const iconPath = iconMap[iconName];

		if (iconPath) {
			parts.push(
				<img
					key={matchStart}
					className="evy-inline-icon"
					src={iconPath}
					alt={iconName}
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

	if (parts.length === 0) {
		return input;
	}

	return parts;
}
