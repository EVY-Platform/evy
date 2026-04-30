/**
 * Build PostgreSQL connection URL from component env vars.
 * Required: DB_USER, DB_PASS, DB_PORT, DB_DOMAIN, DB_EVY_DATABASE.
 */
export function getConnectionUrl(): string {
	const user = process.env.DB_USER;
	const pass = process.env.DB_PASS;
	const port = process.env.DB_PORT;
	const domain = process.env.DB_DOMAIN;
	const database = process.env.DB_EVY_DATABASE;

	if (!user || !pass || !port || !domain || !database) {
		const missing = [
			!user && "DB_USER",
			!pass && "DB_PASS",
			!port && "DB_PORT",
			!domain && "DB_DOMAIN",
			!database && "DB_EVY_DATABASE",
		]
			.filter(Boolean)
			.join(", ");
		throw new Error(`Missing required database env: ${missing}`);
	}

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}
