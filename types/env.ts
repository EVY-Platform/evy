/**
 * Shared environment-variable helpers for building Postgres connection URLs.
 *
 * Consumers provide the env var name that holds their database name
 * (e.g. "DB_EVY_DATABASE" or "DB_MARKETPLACE_DATABASE"); the shared
 * connection details (DB_USER, DB_PASS, DB_PORT, DB_DOMAIN) are read the
 * same way everywhere.
 */

export function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`Missing required database env: ${name}`);
	}
	return value;
}

export function getPostgresConnectionUrl(databaseEnvVarName: string): string {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const database = requireEnv(databaseEnvVarName);

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}
