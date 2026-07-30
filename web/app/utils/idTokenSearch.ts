import { splitRefFromPath } from "evy-types/resourceRef";

export type IdSearchToken = {
	text: string;
	start: number;
	end: number;
};

export type SuggestionContext =
	| {
			type: "root";
			trigger: "{" | "," | "(";
			token: IdSearchToken | null;
	  }
	| {
			type: "attribute";
			trigger: ".";
			qualifier: string;
			token: IdSearchToken | null;
	  }
	| {
			type: "none";
			token: IdSearchToken | null;
	  };

const rootSuggestionTriggers = new Set(["{", ",", "("]);

function isExpressionIdentifierCharacter(character: string): boolean {
	return /^[a-zA-Z0-9_$-]$/.test(character);
}

function findTokenAtCursor(
	value: string,
	cursorIndex: number,
	isTokenCharacter: (character: string) => boolean,
): IdSearchToken | null {
	const clampedCursorIndex = Math.min(Math.max(cursorIndex, 0), value.length);
	let searchIndex = clampedCursorIndex;

	if (isTokenCharacter(value[clampedCursorIndex - 1] ?? "")) {
		searchIndex = clampedCursorIndex - 1;
	} else if (!isTokenCharacter(value[clampedCursorIndex] ?? "")) {
		return null;
	}

	let start = searchIndex;
	while (start > 0 && isTokenCharacter(value[start - 1] ?? "")) {
		start -= 1;
	}

	let end = searchIndex + 1;
	while (end < value.length && isTokenCharacter(value[end] ?? "")) {
		end += 1;
	}

	return {
		text: value.slice(start, end),
		start,
		end,
	};
}

function findExpressionSearchTokenAtCursor(
	value: string,
	cursorIndex: number,
): IdSearchToken | null {
	return findTokenAtCursor(
		value,
		cursorIndex,
		isExpressionIdentifierCharacter,
	);
}

function findPreviousNonWhitespaceIndex(
	value: string,
	startIndex: number,
): number {
	let index = startIndex;
	while (index >= 0 && /\s/.test(value[index] ?? "")) index -= 1;
	return index;
}

function findQualifierBeforeDot(value: string, dotIndex: number): string {
	const end = findPreviousNonWhitespaceIndex(value, dotIndex - 1) + 1;
	const prefix = value.slice(0, end);
	const split = splitRefFromPath(prefix);
	if (split) return split.ref;

	let segmentStart = end;
	while (
		segmentStart > 0 &&
		isExpressionIdentifierCharacter(value[segmentStart - 1] ?? "")
	) {
		segmentStart -= 1;
	}
	const lastSegment = value.slice(segmentStart, end);
	if (segmentStart > 0 && value[segmentStart - 1] === ".") {
		const serviceEnd = segmentStart - 1;
		let serviceStart = serviceEnd;
		while (
			serviceStart > 0 &&
			isExpressionIdentifierCharacter(value[serviceStart - 1] ?? "")
		) {
			serviceStart -= 1;
		}
		const serviceSegment = value.slice(serviceStart, serviceEnd);
		if (serviceSegment && lastSegment) {
			const twoSegmentPath = `${serviceSegment}.${lastSegment}`;
			const refSplit = splitRefFromPath(twoSegmentPath);
			return refSplit?.ref ?? twoSegmentPath;
		}
	}
	return lastSegment;
}

export function findSuggestionContextAtCursor(
	value: string,
	cursorIndex: number,
): SuggestionContext {
	const clampedCursorIndex = Math.min(Math.max(cursorIndex, 0), value.length);
	const token = findExpressionSearchTokenAtCursor(value, clampedCursorIndex);
	const triggerSearchStart = token ? token.start - 1 : clampedCursorIndex - 1;
	const triggerIndex = findPreviousNonWhitespaceIndex(
		value,
		triggerSearchStart,
	);
	const trigger = value[triggerIndex] ?? "";

	if (rootSuggestionTriggers.has(trigger)) {
		return {
			type: "root",
			trigger: trigger as "{" | "," | "(",
			token,
		};
	}

	if (trigger === ".") {
		const qualifier = findQualifierBeforeDot(value, triggerIndex);
		if (qualifier) {
			return {
				type: "attribute",
				trigger: ".",
				qualifier,
				token,
			};
		}
	}

	return { type: "none", token };
}

export function replaceSearchToken(
	value: string,
	token: IdSearchToken,
	replacement: string,
): string {
	return value.slice(0, token.start) + replacement + value.slice(token.end);
}
