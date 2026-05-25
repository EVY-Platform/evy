// No HTTP health endpoint exists here,
// so Docker/e2e use this CLI to
// verify DB and seed readiness.
import type { GetRequest, GetResponse } from "evy-types";
import { get as defaultGet } from "./data";

type AssertMarketplaceReadableOptions = {
	requireSeeded: boolean;
};

type MarketplaceReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
};

async function assertMarketplaceReadable(
	options: AssertMarketplaceReadableOptions,
	deps: MarketplaceReadableDeps = { get: defaultGet },
): Promise<void> {
	const { requireSeeded } = options;
	const response = await deps.get({
		service: "marketplace",
		resource: "items",
	});
	if (!Array.isArray(response.data)) {
		throw new Error(
			"Marketplace readiness failed: expected items response data array",
		);
	}

	if (!requireSeeded) {
		return;
	}

	if (response.data.length === 0) {
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
