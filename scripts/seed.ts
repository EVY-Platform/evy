import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pluralize from "pluralize";
import postgres from "postgres";
import { z } from "zod";
import { db as coreDb, schema as coreSchema } from "../api/src/db";
import { validateFlowData, formatZodErrors } from "../api/src/validation";
import { MARKETPLACE_SEED_KEYS } from "../services/marketplace/src/catalog";
import {
	db as marketplaceDb,
	schema as marketplaceSchema,
} from "../services/marketplace/src/db";

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

export function extractMarketplaceData(dataJson: SeedDataMap): SeedDataMap {
	const out: SeedDataMap = {};
	for (const [key, value] of Object.entries(dataJson)) {
		if (MARKETPLACE_SEED_KEYS.has(key)) {
			out[key] = value;
		}
	}
	return out;
}

export async function ensureMarketplaceDatabaseExists(): Promise<void> {
	const dbName = process.env.MARKETPLACE_DB_DATABASE ?? "marketplace";
	if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
		throw new Error("Invalid MARKETPLACE_DB_DATABASE");
	}
	const user = process.env.DB_USER;
	const pass = process.env.DB_PASS;
	const port = process.env.DB_PORT;
	const domain = process.env.DB_DOMAIN;
	if (!user || !pass || !port || !domain) {
		throw new Error("Missing DB_* env for ensureMarketplaceDatabaseExists");
	}
	const sql = postgres({
		host: domain,
		port: Number(port),
		user,
		password: pass,
		database: "postgres",
	});
	try {
		await sql.unsafe(`CREATE DATABASE "${dbName}"`);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("already exists")) {
			await sql.end({ timeout: 5 });
			throw error;
		}
	}
	await sql.end({ timeout: 5 });
}

export async function loadSeedInputs(paths: SeedInputPaths = {}): Promise<{
	evyFlowsJson: SeedFlow[];
	serviceFlowsJson: SeedFlow[];
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

	return { evyFlowsJson, serviceFlowsJson, dataJson };
}

export async function seedDatabase({
	evyFlowsJson,
	serviceFlowsJson,
	marketplaceDataJson,
	now = new Date().toISOString(),
}: {
	evyFlowsJson: SeedFlow[];
	serviceFlowsJson: SeedFlow[];
	marketplaceDataJson: SeedDataMap;
	now?: string;
}) {
	await coreDb.transaction(async (tx) => {
		await tx.delete(coreSchema.flow);
		await tx.delete(coreSchema.data);
		const flowRows = [
			...evyFlowsJson.map((flowData) => ({
				id: flowData.id,
				data: flowData,
				createdAt: now,
				updatedAt: now,
			})),
			...serviceFlowsJson.map((flowData) => ({
				id: flowData.id,
				data: flowData,
				createdAt: now,
				updatedAt: now,
			})),
		];
		if (flowRows.length > 0) {
			await tx.insert(coreSchema.flow).values(flowRows);
		}
	});

	const marketplaceRows: {
		id: string;
		namespace: string;
		resource: string;
		data: SeedDataItem;
		createdAt: string;
		updatedAt: string;
	}[] = [];
	for (const [key, value] of Object.entries(marketplaceDataJson)) {
		const resource = pluralize.singular(key);
		for (const item of value) {
			marketplaceRows.push({
				id: item.id,
				namespace: "marketplace",
				resource,
				data: item,
				createdAt: now,
				updatedAt: now,
			});
		}
	}

	await marketplaceDb.transaction(async (tx) => {
		await tx.delete(marketplaceSchema.data);
		if (marketplaceRows.length > 0) {
			await tx.insert(marketplaceSchema.data).values(marketplaceRows);
		}
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { evyFlowsJson, serviceFlowsJson, dataJson } = await loadSeedInputs();
	const marketplaceDataJson = extractMarketplaceData(dataJson);
	ensureMarketplaceDatabaseExists()
		.then(() =>
			seedDatabase({ evyFlowsJson, serviceFlowsJson, marketplaceDataJson }),
		)
		.then(() => {
			console.log("Seeding complete!");
			process.exit(0);
		})
		.catch((error) => {
			console.error("Seeding failed:", error);
			process.exit(1);
		});
}
