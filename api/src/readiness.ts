import type { GetRequest, GetResponse } from "evy-types";
import { createDb } from "./database/db";
import { get as getCore } from "./data/data";

type AssertApiReadableOptions = {
	requireSeeded: boolean;
};

type ApiReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
};

export async function assertApiReadable(
	options: AssertApiReadableOptions,
	deps: ApiReadableDeps,
): Promise<void> {
	const { requireSeeded } = options;
	const response = await deps.get({ service: "evy", resource: "sdui" });
	if (!Array.isArray(response)) {
		throw new Error("API readiness failed: expected sdui response data array");
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
			{ get: (params) => getCore(db, params) },
		);
		console.info(
			requireSeededData ? "API seeded-data readiness OK" : "API readiness OK",
		);
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}
