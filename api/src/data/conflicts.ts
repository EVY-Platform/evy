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
	readonly expectedUpdatedAt: string;
	readonly actualUpdatedAt: string;

	constructor(expectedUpdatedAt: string, actualUpdatedAt: string) {
		super(
			`Conflict: the record changed since you last read it ` +
				`(expected updated_at ${expectedUpdatedAt}, found ${actualUpdatedAt}). ` +
				`Re-read the record and reapply your change.`,
		);
		this.name = "ConflictError";
		this.expectedUpdatedAt = expectedUpdatedAt;
		this.actualUpdatedAt = actualUpdatedAt;
	}
}

/** Throws when the caller's expected version is not the stored one. */
export function assertNotModified(
	expectedUpdatedAt: string | undefined,
	actualUpdatedAt: string,
): void {
	if (expectedUpdatedAt === undefined) return;
	if (expectedUpdatedAt !== actualUpdatedAt) {
		throw new ConflictError(expectedUpdatedAt, actualUpdatedAt);
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
export { monotonicIso as monotonicUpdatedAt } from "evy-types/monotonic";
