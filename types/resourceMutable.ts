export function assertResourceMutable(
	resource: string,
	visibility: string,
): void {
	if (visibility === "internal") {
		throw new Error(
			`Resource "${resource}" is internal and cannot be created, updated, or deleted via the data API`,
		);
	}
}
