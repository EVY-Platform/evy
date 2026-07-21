/** Shared Postgres error handling for api and marketplace. */

export const PG_UNIQUE_VIOLATION = "23505" as const;

export function hasDatabaseErrorCode(err: unknown, code: string): boolean {
	if (typeof err !== "object" || err === null) {
		return false;
	}

	if ("code" in err && err.code === code) {
		return true;
	}

	return "cause" in err && hasDatabaseErrorCode(err.cause, code);
}
