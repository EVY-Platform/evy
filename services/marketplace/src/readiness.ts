import type { GetRequest, GetResponse } from "evy-types";
import { get as defaultGet } from "./data";

type AssertMarketplaceReadableOptions = {
	requireSeeded: boolean;
};

type MarketplaceReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
};

export async function assertMarketplaceReadable(
	options: AssertMarketplaceReadableOptions,
	deps: MarketplaceReadableDeps = { get: defaultGet },
): Promise<void> {
	const { requireSeeded } = options;
	const items = await deps.get({ namespace: "marketplace", resource: "items" });
	if (!Array.isArray(items)) {
		throw new Error(
			"Marketplace readiness failed: expected items response array",
		);
	}

	if (!requireSeeded) {
		return;
	}

	if (items.length === 0) {
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
