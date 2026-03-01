export function isCorrectDate(date: Date): boolean {
	return date instanceof Date && isFinite(+date);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
