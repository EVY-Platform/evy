import { unwrapOptionalBraces } from "./unwrapBraces";

const API_SOURCE_PREFIX = "$api:";

export type SourceBinding =
	| { kind: "api"; method: string }
	| { kind: "resource"; resourceId: string };

export function parseSourceBinding(source: string): SourceBinding | null {
	const expression = unwrapOptionalBraces(source);
	if (expression.startsWith(API_SOURCE_PREFIX)) {
		const method = expression.slice(API_SOURCE_PREFIX.length).trim();
		return method ? { kind: "api", method } : null;
	}

	const resourceId = expression.split(".")[0]?.trim();
	return resourceId ? { kind: "resource", resourceId } : null;
}
