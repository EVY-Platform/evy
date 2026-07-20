// No HTTP health endpoint exists here,
// so Docker/e2e use this CLI to
// verify DB and seed readiness.
import { get } from "./data";
import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "./resources";

type AssertMarketplaceReadableOptions = {
	requireSeeded: boolean;
};

async function assertMarketplaceReadable(
	options: AssertMarketplaceReadableOptions,
): Promise<void> {
	const { requireSeeded } = options;
	const response = await get({
		service: MARKETPLACE_SERVICE,
		resource: MARKETPLACE_RESOURCE.ITEMS,
	});
	if (!Array.isArray(response)) {
		throw new Error(
			"Marketplace readiness failed: expected items response data array",
		);
	}

	if (!requireSeeded) {
		return;
	}

	if (response.length === 0) {
		throw new Error(
			"Marketplace seed verification failed: missing seeded items data",
		);
	}
}

async function runCli(): Promise<void> {
	const requireSeededData = process.argv.includes("--require-seeded");
	try {
		await assertMarketplaceReadable({ requireSeeded: requireSeededData });
		console.info(
			requireSeededData
				? "Marketplace seeded-data readiness OK"
				: "Marketplace readiness OK",
		);
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

if (import.meta.main) {
	await runCli();
}
