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

import { toNanoIso } from "evy-types/clock";

function versionTokensMatch(expected: string, actual: string): boolean {
	const normExpected = toNanoIso(expected);
	const normActual = toNanoIso(actual);
	if (normExpected === normActual) return true;

	// Clients that only retain millisecond precision (iOS, pre-migration tokens)
	// send a three-digit fraction; match on that prefix.
	const expectedFraction = /\.(\d+)/.exec(expected)?.[1] ?? "";
	if (expectedFraction.length <= 3) {
		return normExpected.slice(0, 23) === normActual.slice(0, 23);
	}
	return false;
}

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
	if (!versionTokensMatch(expectedUpdatedAt, actualUpdatedAt)) {
		throw new ConflictError(expectedUpdatedAt, actualUpdatedAt);
	}
}

// Version tokens advance on every write via `evy-types/clock` (`nowIso`).
