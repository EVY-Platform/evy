import type { GetRequest, GetResponse, UI_Flow } from "evy-types";
import { get as defaultGet } from "./rpc";
import { validateFlowData } from "./validation";

type AssertApiReadableOptions = {
	requireSeeded: boolean;
};

type ApiReadableDeps = {
	get: (params: GetRequest) => Promise<GetResponse>;
};

function isFlow(value: unknown): value is UI_Flow {
	if (value === null || typeof value !== "object") {
		return false;
	}
	try {
		validateFlowData(value);
		return true;
	} catch {
		return false;
	}
}

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

	const hasSeededViewItemFlow = flows.some(
		(flow) => isFlow(flow) && flow.name === "View Item",
	);
	if (!hasSeededViewItemFlow) {
		throw new Error(
			"Seed verification failed: missing seeded 'View Item' flow",
		);
	}

	const items = await deps.get({ namespace: "marketplace", resource: "items" });
	if (!Array.isArray(items) || items.length === 0) {
		throw new Error("Seed verification failed: missing seeded items data");
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
