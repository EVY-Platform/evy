/**
 * Marketplace PostgreSQL URL from DB_USER, DB_PASS, DB_PORT, DB_DOMAIN.
 * Database name: MARKETPLACE_DB_DATABASE (default `marketplace`).
 */
export function getMarketplaceConnectionUrl(): string {
	const user = process.env.DB_USER;
	const pass = process.env.DB_PASS;
	const port = process.env.DB_PORT;
	const domain = process.env.DB_DOMAIN;
	const database = process.env.MARKETPLACE_DB_DATABASE ?? "marketplace";

	if (!user || !pass || !port || !domain) {
		const missing = [
			!user && "DB_USER",
			!pass && "DB_PASS",
			!port && "DB_PORT",
			!domain && "DB_DOMAIN",
		]
			.filter(Boolean)
			.join(", ");
		throw new Error(`Missing required database env: ${missing}`);
	}

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}
