export function parsePhotoIds(source: string): string[] {
	const trimmed = source.trim();
	if (!trimmed || trimmed.startsWith("{")) return [];

	if (trimmed.startsWith("[")) {
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed.filter((x): x is string => typeof x === "string");
			}
		} catch {
			// Not valid JSON — fall through to comma split
		}
	}

	return trimmed
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}
