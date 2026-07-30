import { runReadinessCli } from "evy-types/readiness";
import { get } from "./data";
import { MARKETPLACE_RESOURCE } from "./resources";

async function assertMarketplaceReadable(
	requireSeeded: boolean,
): Promise<void> {
	const response = await get({
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

if (import.meta.main) {
	await runReadinessCli({
		label: "Marketplace",
		assertReadable: assertMarketplaceReadable,
	});
}
