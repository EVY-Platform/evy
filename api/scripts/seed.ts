import { db, flow, data } from "../src/db";
import type { ValidatedFlowData } from "../src/validation";

const EVY_FLOWS_PATH = "../docs/evy/evy_sdui.json";
const SERVICE_FLOWS_PATH = "../docs/services/service_sdui.json";
const DATA_PATH = "../docs/services/service_data.json";

async function seed() {
	console.log("Seeding database...");

	const evyFlowsJson = (await Bun.file(
		EVY_FLOWS_PATH,
	).json()) as ValidatedFlowData[];
	const serviceFlowsJson = (await Bun.file(
		SERVICE_FLOWS_PATH,
	).json()) as ValidatedFlowData[];
	const dataJson = await Bun.file(DATA_PATH).json();

	// Combine flows with evy flows first (includes home flow)
	const flowsJson = [...evyFlowsJson, ...serviceFlowsJson];

	console.log(
		`Found ${flowsJson.length} flows to seed (${evyFlowsJson.length} evy + ${serviceFlowsJson.length} service)`,
	);

	console.log("Clearing existing data...");
	await db.delete(flow);
	await db.delete(data);

	console.log("Inserting flows...");
	for (const flowData of flowsJson) {
		await db.insert(flow).values({
			id: flowData.id,
			data: flowData,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		console.log(`  Inserted flow: ${flowData.name} (${flowData.id})`);
	}

	console.log("Inserting service data...");
	await db.insert(data).values({
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
