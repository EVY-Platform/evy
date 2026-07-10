import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import * as data from "./data/data";
import { createDb, type EvyDb } from "./database/db";
import { requireServiceGrpcEndpoint } from "./procedures/services";

type AssertApiReadableOptions = {
	requireSeeded: boolean;
};

export async function assertApiReadable(
	db: EvyDb,
	options: AssertApiReadableOptions,
): Promise<void> {
	const { requireSeeded } = options;

	const externalServices = await data.listExternalServices(db);
	for (const { id, name } of externalServices) {
		requireServiceGrpcEndpoint(name, id);
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

export async function runHealthCli(): Promise<void> {
	const db = createDb();
	const requireSeededData = process.argv.includes("--require-seeded");
	try {
		await assertApiReadable(db, { requireSeeded: requireSeededData });
		console.info(
			requireSeededData
				? "API seeded-data readiness OK"
				: "API readiness OK",
		);
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}
