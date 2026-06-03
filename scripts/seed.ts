/// <reference types="bun-types" />

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate as migratePg } from "drizzle-orm/bun-sql/migrator";
import { pgTable, jsonb, text, uuid, varchar } from "drizzle-orm/pg-core";
import { readFile } from "node:fs/promises";

import { MARKETPLACE_SEED_RESOURCES } from "../services/marketplace/src/resources";
import { validateUiFlow } from "../types/validators";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateSeedDataItemShape(
	item: unknown,
): { id: string } & Record<string, unknown> {
	if (item === null || typeof item !== "object" || Array.isArray(item)) {
		throw new Error("Seed data item must be a non-null object");
	}
	const record = item as Record<string, unknown>;
	if (typeof record.id !== "string" || !UUID_RE.test(record.id)) {
		throw new Error("Seed data item must have a valid UUID 'id' field");
	}
	return record as { id: string } & Record<string, unknown>;
}

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
const API_MIGRATIONS_PATH = join(SCRIPT_DIR, "..", "api", "drizzle");
const MARKETPLACE_MIGRATIONS_PATH = join(
	SCRIPT_DIR,
	"..",
	"services",
	"marketplace",
	"drizzle",
);

type SeedFlow = ReturnType<typeof validateUiFlow>;
type SeedDataItem = ReturnType<typeof validateSeedDataItemShape>;
type SeedDataMap = Record<string, SeedDataItem[]>;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === "") {
		throw new Error(`Missing required database env: ${name}`);
	}
	return value;
}

function getConnectionUrl(databaseEnvName: string): string {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const database = requireEnv(databaseEnvName);

	const encodedUser = encodeURIComponent(user);
	const encodedPass = encodeURIComponent(pass);
	return `postgresql://${encodedUser}:${encodedPass}@${domain}:${port}/${database}`;
}

const flowTable = pgTable("Flow", {
	id: uuid("id").primaryKey().defaultRandom(),
	data: jsonb("data").$type<SeedFlow>().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

const marketplaceDataTable = pgTable("Data", {
	id: uuid("id").primaryKey().defaultRandom(),
	resource: varchar("resource", { length: 50 }).notNull(),
	data: jsonb("data").$type<SeedDataItem>().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

const coreSchema = { flow: flowTable };
const marketplaceSchema = { data: marketplaceDataTable };

const coreSqlClient = new SQL(getConnectionUrl("DB_EVY_DATABASE"));
const marketplaceSqlClient = new SQL(
	getConnectionUrl("DB_MARKETPLACE_DATABASE"),
);

const coreDb = drizzle({ client: coreSqlClient, schema: coreSchema });
const marketplaceDb = drizzle({
	client: marketplaceSqlClient,
	schema: marketplaceSchema,
});

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
	try {
		return validateSeedDataItemShape(item);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new Error(
			`Seed data validation failed for resource "${resource}" at index ${index}: ${msg}`,
		);
	}
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

function partitionSeedResourceData(dataJson: SeedDataMap): {
	marketplace: SeedDataMap;
	evy: SeedDataMap;
} {
	const marketplace: SeedDataMap = {};
	const evy: SeedDataMap = {};
	for (const [resource, value] of Object.entries(dataJson)) {
		if (MARKETPLACE_SEED_RESOURCES.has(resource)) {
			marketplace[resource] = value;
		} else {
			evy[resource] = value;
		}
	}
	return { marketplace, evy };
}

type SeedDataRow = {
	id: string;
	resource: string;
	data: SeedDataItem;
	createdAt: string;
	updatedAt: string;
};

function buildDataRows(dataJson: SeedDataMap, now: string): SeedDataRow[] {
	const rows: SeedDataRow[] = [];
	for (const [resource, value] of Object.entries(dataJson)) {
		for (const item of value) {
			rows.push({
				id: item.id,
				resource,
				data: item,
				createdAt: now,
				updatedAt: now,
			});
		}
	}
	return rows;
}

function quotePostgresIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureMarketplaceDatabaseExists(): Promise<void> {
	const user = requireEnv("DB_USER");
	const pass = requireEnv("DB_PASS");
	const port = requireEnv("DB_PORT");
	const domain = requireEnv("DB_DOMAIN");
	const dbName = requireEnv("DB_MARKETPLACE_DATABASE");
	const sqlClient = new SQL({
		hostname: domain,
		port: Number(port),
		username: user,
		password: pass,
		database: "postgres",
	});
	try {
		await sqlClient.unsafe(
			`CREATE DATABASE ${quotePostgresIdentifier(dbName)}`,
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("already exists")) {
			throw error;
		}
	} finally {
		await sqlClient.close({ timeout: 5 });
	}
}

async function runMigrations(): Promise<void> {
	await migratePg(coreDb, { migrationsFolder: API_MIGRATIONS_PATH });
	await migratePg(marketplaceDb, {
		migrationsFolder: MARKETPLACE_MIGRATIONS_PATH,
	});
}

function normalizeSeedFlows(raw: unknown): unknown[] {
	if (Array.isArray(raw)) {
		return raw;
	}
	if (raw !== null && typeof raw === "object") {
		return [raw];
	}
	throw new Error("Flow files must export JSON objects or arrays");
}

async function loadSeedInputs(paths: SeedInputPaths = {}): Promise<{
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
	const evyFlowsArray = normalizeSeedFlows(evyFlowsRaw);
	const serviceFlowsArray = normalizeSeedFlows(serviceFlowsRaw);
	const evyFlowsJson = evyFlowsArray.map((f: unknown) => validateUiFlow(f));
	const serviceFlowsJson = serviceFlowsArray.map((f: unknown) =>
		validateUiFlow(f),
	);
	const dataJson = validateSeedData(
		JSON.parse(await readFile(paths.dataPath ?? DATA_PATH, "utf-8")),
	);

	return { evyFlowsJson, serviceFlowsJson, dataJson };
}

async function seedDatabase({
	evyFlowsJson,
	serviceFlowsJson,
	evyDataJson,
	marketplaceDataJson,
	now = new Date().toISOString(),
}: {
	evyFlowsJson: SeedFlow[];
	serviceFlowsJson: SeedFlow[];
	evyDataJson: SeedDataMap;
	marketplaceDataJson: SeedDataMap;
	now?: string;
}) {
	if (Object.keys(evyDataJson).length > 0) {
		throw new Error(
			`Seeding non-marketplace resources into the API database is not implemented (got: ${Object.keys(evyDataJson).join(", ")}). Add dedicated-table inserts for Service, Organization, or ServiceProvider if needed.`,
		);
	}

	await coreDb.transaction(async (tx) => {
		await tx.delete(coreSchema.flow);
		const flowRows = [...evyFlowsJson, ...serviceFlowsJson].map((flowData) => ({
			id: flowData.id,
			data: flowData,
			createdAt: now,
			updatedAt: now,
		}));
		if (flowRows.length > 0) {
			await tx.insert(coreSchema.flow).values(flowRows);
		}
	});

	const marketplaceRows = buildDataRows(marketplaceDataJson, now);

	await marketplaceDb.transaction(async (tx) => {
		await tx.delete(marketplaceSchema.data);
		if (marketplaceRows.length > 0) {
			await tx.insert(marketplaceSchema.data).values(marketplaceRows);
		}
	});
}

async function main(): Promise<void> {
	const { evyFlowsJson, serviceFlowsJson, dataJson } = await loadSeedInputs();
	const { marketplace: marketplaceDataJson, evy: evyDataJson } =
		partitionSeedResourceData(dataJson);
	await ensureMarketplaceDatabaseExists();
	await runMigrations();
	await seedDatabase({
		evyFlowsJson,
		serviceFlowsJson,
		evyDataJson,
		marketplaceDataJson,
	});
	console.info("Seeding complete.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		await main();
	} catch (error) {
		console.error("Seeding failed:", error);
		process.exitCode = 1;
	} finally {
		await Promise.all([
			coreSqlClient.close({ timeout: 5 }),
			marketplaceSqlClient.close({ timeout: 5 }),
		]);
	}
}
