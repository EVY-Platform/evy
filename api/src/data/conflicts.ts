/**
 * Optimistic locking for concurrent writers.
 *
 * Two builder sessions editing the same flow both send their whole diff, and
 * without a precondition the later write silently overwrites the earlier one -
 * the losing editor sees their change vanish with no error anywhere.
 *
 * A writer that knows which version it read can say so, and a write against a
 * version that has since moved is rejected instead of applied. Omitting the
 * precondition keeps the old last-write-wins behaviour, so clients that do not
 * track versions (iOS, the seed) are unaffected.
 */

export class ConflictError extends Error {
	readonly code = "CONFLICT";
	readonly expected_updated_at: string;
	readonly actualUpdatedAt: string;

	constructor(expected_updated_at: string, actualUpdatedAt: string) {
		super(
			`Conflict: the record changed since you last read it ` +
				`(expected updated_at ${expected_updated_at}, found ${actualUpdatedAt}). ` +
				`Re-read the record and reapply your change.`,
		);
		this.name = "ConflictError";
		this.expected_updated_at = expected_updated_at;
		this.actualUpdatedAt = actualUpdatedAt;
	}
}

/** Throws when the caller's expected version is not the stored one. */
export function assertNotModified(
	expected_updated_at: string | undefined,
	actualUpdatedAt: string,
): void {
	if (expected_updated_at === undefined) return;
	if (expected_updated_at !== actualUpdatedAt) {
		throw new ConflictError(expected_updated_at, actualUpdatedAt);
	}
}

/**
 * The row's next `updated_at`, guaranteed to be greater than its current one.
 *
 * `updated_at` doubles as the version token, and wall-clock time has
 * millisecond resolution - two writes inside the same millisecond would leave
 * it unchanged, so a second writer's stale token would still match and the
 * lock would pass exactly when it needed to fail. Nudging forward by a
 * millisecond keeps the value a timestamp while making it strictly increase
 * per row, which is what the precondition relies on.
 */
export function monotonicUpdatedAt(
	nowIso: string,
	currentUpdatedAt: string,
): string {
	if (nowIso > currentUpdatedAt) return nowIso;
	return new Date(new Date(currentUpdatedAt).getTime() + 1).toISOString();
}
