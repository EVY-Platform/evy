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
	if (variableName === "true" || variableName === "false")
		return variableName;
	return sentenceCaseFirstLetter(underscoresToSpaces(variableName));
}
