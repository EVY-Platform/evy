/** `snake_case` or `path.to_snake` → words with spaces (no capitalization). */
function underscoresToSpaces(s: string): string {
	return s.replace(/_/g, " ");
}

/** Capitalizes the first character of the string. */
function sentenceCaseFirstLetter(s: string): string {
	if (s.length === 0) return s;
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Variable / property names for action UI: `foo_bar` → `Foo bar`, `true`/`false` unchanged.
 */
export function displayLabel(variableName: string): string {
	if (variableName === "true" || variableName === "false") return variableName;
	return sentenceCaseFirstLetter(underscoresToSpaces(variableName));
}

/**
 * Turns identifiers like `ColumnContainer` or `textRow` into spaced words for display.
 */
export function splitCamelCaseToWords(identifier: string): string {
	return identifier
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.trim();
}

/**
 * Last segment of a dotted path, with underscores replaced by spaces (for inline text).
 */
export function propPathToFriendlyLabel(propPath: string): string {
	const lastSegment = propPath.split(".").pop() ?? propPath;
	return underscoresToSpaces(lastSegment);
}
