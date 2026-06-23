import { ne } from "drizzle-orm";
import type { GetRequest, GetResponse } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { service } from "../../types/generated/ts/db/schema.generated";
import { get as getCore } from "./data/data";
import { createDb } from "./database/db";
import { requireServiceGrpcEndpoint } from "./procedures/services";

type AssertApiReadableOptions = {
	requireSeeded: boolean;
};

type ApiReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
	listExternalServices: () => Promise<Array<{ id: string; name: string }>>;
};

export async function assertApiReadable(
	options: AssertApiReadableOptions,
	deps: ApiReadableDeps,
): Promise<void> {
	const { requireSeeded } = options;

	const externalServices = await deps.listExternalServices();
	for (const { id, name } of externalServices) {
		requireServiceGrpcEndpoint(name, id);
	}

	const response = await deps.get({
		service: EVY_CORE_SERVICE,
		resource: "sdui",
	});
	if (!Array.isArray(response)) {
		throw new Error(
			"API readiness failed: expected sdui response data array",
		);
	}

	if (!requireSeeded) {
		return;
	}

	if (response.length === 0) {
		throw new Error("Seed verification failed: missing seeded SDUI flows");
	}
}

export async function runHealthCli(): Promise<void> {
	const db = createDb();
	const requireSeededData = process.argv.includes("--require-seeded");
	try {
		await assertApiReadable(
			{ requireSeeded: requireSeededData },
			{
				get: (params) => getCore(db, params),
				listExternalServices: () =>
					db
						.select({ id: service.id, name: service.name })
						.from(service)
						.where(ne(service.id, EVY_CORE_SERVICE)),
			},
		);
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
