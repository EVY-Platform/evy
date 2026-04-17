/**
 * Marketplace PostgreSQL URL from DB_USER, DB_PASS, DB_PORT, DB_DOMAIN.
 * Database name: MARKETPLACE_DB_DATABASE (default `marketplace`).
 */
function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`Missing required database env: ${name}`);
	}
	return value;
}

export function getMarketplaceConnectionUrl(): string {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const database = process.env.MARKETPLACE_DB_DATABASE ?? "marketplace";

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}
