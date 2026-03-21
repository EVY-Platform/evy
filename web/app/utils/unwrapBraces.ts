/** If wrapped in `{...}`, returns inner trimmed text; otherwise returns trimmed `s`. */
export function unwrapOptionalBraces(s: string): string {
	const t = s.trim();
	if (t.startsWith("{") && t.endsWith("}")) {
		return t.slice(1, -1).trim();
	}
	return t;
}
