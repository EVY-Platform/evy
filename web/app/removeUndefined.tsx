export function removeUndefined<T>(obj: T): T {
	if (obj === null || obj === undefined) return obj;
	if (Array.isArray(obj)) return obj.map(removeUndefined) as T;
	if (typeof obj === "object") {
		const cleaned: T = {} as T;
		for (const [key, value] of Object.entries(obj) as [
			keyof T,
			T[keyof T]
		][]) {
			if (value !== undefined) {
				cleaned[key] = removeUndefined(value);
			}
		}
		return cleaned;
	}
	return obj;
}
