import type { GetRequest, GetResponse } from "evy-types";
import { get as defaultGet } from "./rpc";

type AssertApiReadableOptions = {
	requireSeeded: boolean;
};

type ApiReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
};

export async function assertApiReadable(
	options: AssertApiReadableOptions,
	deps: ApiReadableDeps = { get: defaultGet },
): Promise<void> {
	const { requireSeeded } = options;
	const flows = await deps.get({ namespace: "evy", resource: "sdui" });
	if (!Array.isArray(flows)) {
		throw new Error("API readiness failed: expected sdui response array");
	}

	if (!requireSeeded) {
		return;
	}

	if (flows.length === 0) {
		throw new Error("Seed verification failed: missing seeded SDUI flows");
	}
}

async function runCli(): Promise<void> {
	const requireSeededData = process.argv.includes("--require-seeded");
	try {
		await assertApiReadable({ requireSeeded: requireSeededData });
		console.info(
			requireSeededData ? "API seeded-data readiness OK" : "API readiness OK",
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
