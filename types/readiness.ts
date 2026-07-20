/**
 * Shared readiness CLI wrapper. No HTTP health endpoints exist, so
 * Docker/e2e run these CLIs to verify DB and seed readiness.
 */
export async function runReadinessCli(options: {
	label: string;
	assertReadable: (requireSeeded: boolean) => Promise<void>;
}): Promise<void> {
	const requireSeeded = process.argv.includes("--require-seeded");
	try {
		await options.assertReadable(requireSeeded);
		console.info(
			requireSeeded
				? `${options.label} seeded-data readiness OK`
				: `${options.label} readiness OK`,
		);
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}
