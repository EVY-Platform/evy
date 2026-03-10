import type { SDUI_Flow } from "evy-types/sdui/evy";
import { get } from "./data";

const requireSeededData = process.argv.includes("--require-seeded");

function isFlow(value: unknown): value is SDUI_Flow {
	return (
		value !== null &&
		typeof value === "object" &&
		"name" in value &&
		typeof value.name === "string"
	);
}

async function assertApiReadable(): Promise<void> {
	const flows = await get({ namespace: "evy", resource: "sdui" });
	if (!Array.isArray(flows)) {
		throw new Error("API readiness failed: expected sdui response array");
	}

	if (!requireSeededData) {
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

	const items = await get({ namespace: "evy", resource: "items" });
	if (!Array.isArray(items) || items.length === 0) {
		throw new Error("Seed verification failed: missing seeded items data");
	}
}

try {
	await assertApiReadable();
	console.info(
		requireSeededData ? "API seeded-data readiness OK" : "API readiness OK",
	);
	process.exit(0);
} catch (error) {
	console.error(error);
	process.exit(1);
}
