/**
 * Runs `body` with environment overrides, restoring every key afterwards.
 *
 * Hand-rolled save/assign/restore blocks are easy to get subtly wrong - one
 * key forgotten in the restore leaks into every later test in the file, and a
 * throw part-way through skips the restore entirely. `finally` covers both.
 *
 * A value of `undefined` deletes the variable for the duration.
 */
export async function withEnvironment<T>(
	overrides: Record<string, string | undefined>,
	body: () => T | Promise<T>,
): Promise<T> {
	const saved = new Map<string, string | undefined>();

	for (const [key, value] of Object.entries(overrides)) {
		saved.set(key, process.env[key]);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	try {
		return await body();
	} finally {
		for (const [key, value] of saved) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}
