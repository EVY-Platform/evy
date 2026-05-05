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
 * Converts a dotted path to a readable label, preserving full context.
 * e.g. "item.title" → "Item title", "user.address.postcode" → "User address postcode"
 */
export function propPathToFriendlyLabel(propPath: string): string {
	const segments = propPath.split(".");
	if (segments.length === 0) return propPath;
	const spaced = segments.map((segment) => underscoresToSpaces(segment));
	spaced[0] = sentenceCaseFirstLetter(spaced[0]);
	return spaced.join(" ");
}
