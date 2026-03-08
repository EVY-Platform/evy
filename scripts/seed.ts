import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { db, schema } from "../api/src/db";
import { validateFlowData } from "../api/src/validation";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVY_FLOWS_PATH = join(SCRIPT_DIR, "..", "docs", "evy", "evy_sdui.json");
const SERVICE_FLOWS_PATH = join(
	SCRIPT_DIR,
	"..",
	"docs",
	"services",
	"service_sdui.json",
);
const DATA_PATH = join(
	SCRIPT_DIR,
	"..",
	"docs",
	"services",
	"service_data.json",
);

async function seed() {
	const evyFlowsRaw = JSON.parse(await readFile(EVY_FLOWS_PATH, "utf-8"));
	const serviceFlowsRaw = JSON.parse(
		await readFile(SERVICE_FLOWS_PATH, "utf-8"),
	);
	if (!Array.isArray(evyFlowsRaw) || !Array.isArray(serviceFlowsRaw)) {
		throw new Error("Flow files must export JSON arrays");
	}
	const evyFlowsJson = evyFlowsRaw.map((f: unknown) => validateFlowData(f));
	const serviceFlowsJson = serviceFlowsRaw.map((f: unknown) =>
		validateFlowData(f),
	);
	const dataJson = JSON.parse(await readFile(DATA_PATH, "utf-8"));

	// Combine flows with evy flows first (includes home flow)
	const flowsJson = [...evyFlowsJson, ...serviceFlowsJson];

	await db.delete(schema.flow);
	await db.delete(schema.data);

	for (const flowData of flowsJson) {
		await db.insert(schema.flow).values({
			id: flowData.id,
			data: flowData,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}

	await db.insert(schema.data).values({
		data: dataJson,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	console.log("Seeding complete!");
	process.exit(0);
}

seed().catch((error) => {
	console.error("Seeding failed:", error);
	process.exit(1);
});
