import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { runReadinessCli } from "evy-types/readiness";
import * as data from "./data/data";
import { createDb, type EvyDb } from "./database/db";
import { requireServiceWsEndpoint } from "./procedures/services";

// exported for tests
export async function assertApiReadable(
	db: EvyDb,
	requireSeeded: boolean,
): Promise<void> {
	const externalServices = await data.listExternalServices(db);
	for (const { id, name } of externalServices) {
		requireServiceWsEndpoint(name, id);
	}

	const response = await data.get(db, {
		service: EVY_CORE_SERVICE,
		resource: EVY_CORE_RESOURCE.FLOWS,
	});
	if (!Array.isArray(response)) {
		throw new Error(
			"API readiness failed: expected flows response data array",
		);
	}

	if (!requireSeeded) {
		return;
	}

	if (response.length === 0) {
		throw new Error("Seed verification failed: missing seeded flows");
	}
}

export function runHealthCli(): Promise<void> {
	const db = createDb();
	return runReadinessCli({
		label: "API",
		assertReadable: (requireSeeded) => assertApiReadable(db, requireSeeded),
	});
}
