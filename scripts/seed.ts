import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pluralize from "pluralize";
import { z } from "zod";
import { db, schema } from "../api/src/db";
import { validateFlowData, formatZodErrors } from "../api/src/validation";

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

const SeedDataItemSchema = z.looseObject({
	id: z.uuid(),
});

type SeedFlow = ReturnType<typeof validateFlowData>;
type SeedDataItem = z.infer<typeof SeedDataItemSchema>;
type SeedDataMap = Record<string, SeedDataItem[]>;
type SeedInputPaths = {
	evyFlowsPath?: string;
	serviceFlowsPath?: string;
	dataPath?: string;
};
type SeedDb = {
	delete: (table: unknown) => Promise<unknown>;
	insert: (table: unknown) => {
		values: (value: unknown) => Promise<unknown>;
	};
};

// Drizzle types are resolved from both the repo root and `api/` package in this workspace,
// so use a narrow runtime shape here to avoid cross-package type incompatibilities.
const seedDb = db as unknown as SeedDb;

function validateSeedDataItem(
	item: unknown,
	resource: string,
	index: number,
): SeedDataItem {
	const result = SeedDataItemSchema.safeParse(item);
	if (!result.success) {
		throw new Error(
			`Seed data validation failed for resource "${resource}" at index ${index}: ${formatZodErrors(result.error.issues)}`,
		);
	}
	return result.data;
}

function validateSeedData(dataJson: unknown): SeedDataMap {
	if (
		dataJson === null ||
		typeof dataJson !== "object" ||
		Array.isArray(dataJson)
	) {
		throw new Error("Seed data file must export a JSON object");
	}

	const validatedEntries: SeedDataMap = {};
	for (const [resource, value] of Object.entries(dataJson)) {
		const items = Array.isArray(value) ? value : [value];
		validatedEntries[resource] = items.map((item, index) =>
			validateSeedDataItem(item, resource, index),
		);
	}

	return validatedEntries;
}

export async function loadSeedInputs(): Promise<{
	flowsJson: SeedFlow[];
	dataJson: SeedDataMap;
}>;
export async function loadSeedInputs(paths: SeedInputPaths): Promise<{
	flowsJson: SeedFlow[];
	dataJson: SeedDataMap;
}>;
export async function loadSeedInputs(paths: SeedInputPaths = {}): Promise<{
	flowsJson: SeedFlow[];
	dataJson: SeedDataMap;
}> {
	const evyFlowsRaw = JSON.parse(
		await readFile(paths.evyFlowsPath ?? EVY_FLOWS_PATH, "utf-8"),
	);
	const serviceFlowsRaw = JSON.parse(
		await readFile(paths.serviceFlowsPath ?? SERVICE_FLOWS_PATH, "utf-8"),
	);
	if (!Array.isArray(evyFlowsRaw) || !Array.isArray(serviceFlowsRaw)) {
		throw new Error("Flow files must export JSON arrays");
	}
	const evyFlowsJson = evyFlowsRaw.map((f: unknown) => validateFlowData(f));
	const serviceFlowsJson = serviceFlowsRaw.map((f: unknown) =>
		validateFlowData(f),
	);
	const dataJson = validateSeedData(
		JSON.parse(await readFile(paths.dataPath ?? DATA_PATH, "utf-8")),
	);

	// Combine flows with evy flows first (includes home flow)
	const flowsJson = [...evyFlowsJson, ...serviceFlowsJson];

	return { flowsJson, dataJson };
}

export async function seedDatabase({
	flowsJson,
	dataJson,
	now = new Date(),
}: {
	flowsJson: SeedFlow[];
	dataJson: SeedDataMap;
	now?: Date;
}) {
	await seedDb.delete(schema.flow);
	await seedDb.delete(schema.data);

	for (const flowData of flowsJson) {
		await seedDb.insert(schema.flow).values({
			id: flowData.id,
			data: flowData,
			createdAt: now,
			updatedAt: now,
		});
	}

	for (const [key, value] of Object.entries(dataJson)) {
		const resource = pluralize.singular(key);
		for (const item of value) {
			await seedDb.insert(schema.data).values({
				id: item.id,
				namespace: "evy",
				resource,
				data: item,
				createdAt: now,
				updatedAt: now,
			});
		}
	}
}

// Keep this module safe to import in tests while still allowing direct script execution.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { flowsJson, dataJson } = await loadSeedInputs();
	seedDatabase({ flowsJson, dataJson })
		.then(() => {
			console.log("Seeding complete!");
			process.exit(0);
		})
		.catch((error) => {
			console.error("Seeding failed:", error);
			process.exit(1);
		});
}
