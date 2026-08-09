import { unwrapOptionalBraces } from "evy-types/unwrapBraces";

const API_SOURCE_PREFIX = "$api:";

export function parseApiSourceMethod(source: string): string | null {
	const expression = unwrapOptionalBraces(source);
	if (!expression.startsWith(API_SOURCE_PREFIX)) {
		return null;
	}
	const method = expression.slice(API_SOURCE_PREFIX.length).trim();
	return method || null;
}
