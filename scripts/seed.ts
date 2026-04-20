import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pluralize from "pluralize";
import postgres from "postgres";
import { pgTable, jsonb, text, uuid, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { MARKETPLACE_SEED_KEYS } from "../services/marketplace/src/catalog";
import { validateUiFlow } from "../types/validators";

const SEED_DATA_ITEM_SCHEMA_ID =
	"https://evy.local/seed/seed-data-item.schema.json";
const SEED_DATA_ITEM_SCHEMA: Record<string, unknown> = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: SEED_DATA_ITEM_SCHEMA_ID,
	type: "object",
	additionalProperties: true,
	required: ["id"],
	properties: {
		id: { type: "string", format: "uuid" },
	},
};

let seedItemAjv: InstanceType<typeof Ajv2020> | null = null;
function validateSeedDataItemShape(
	item: unknown,
): { id: string } & Record<string, unknown> {
	if (!seedItemAjv) {
		const ajv = new Ajv2020({ allErrors: true, strict: false });
		addFormats(ajv);
		ajv.addSchema(SEED_DATA_ITEM_SCHEMA);
		seedItemAjv = ajv;
	}
	const validate = seedItemAjv.getSchema<
		{
			id: string;
		} & Record<string, unknown>
	>(SEED_DATA_ITEM_SCHEMA_ID);
	if (!validate) {
		throw new Error("seed: ajv schema not registered");
	}
	if (validate(item)) {
		return item as { id: string } & Record<string, unknown>;
	}
	const errs = validate.errors;
	const detail = errs?.length
		? errs
				.map((e) => {
					const path = e.instancePath === "" ? "(root)" : e.instancePath;
					return `${path}: ${e.message ?? "invalid"}`;
				})
				.join("; ")
		: "invalid";
	throw new Error(`Seed data item validation failed: ${detail}`);
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

const coreDb = drizzle(postgres(getConnectionUrl("DB_EVY_DATABASE")), {
	schema: coreSchema,
});
const marketplaceDb = drizzle(
	postgres(getConnectionUrl("DB_MARKETPLACE_DATABASE")),
	{ schema: marketplaceSchema },
);

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

function partitionSeedCatalogData(dataJson: SeedDataMap): {
	marketplace: SeedDataMap;
	evy: SeedDataMap;
} {
	const marketplace: SeedDataMap = {};
	const evy: SeedDataMap = {};
	for (const [key, value] of Object.entries(dataJson)) {
		if (MARKETPLACE_SEED_KEYS.has(key)) {
			marketplace[key] = value;
		} else {
			evy[key] = value;
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
	for (const [key, value] of Object.entries(dataJson)) {
		const resource = pluralize.singular(key);
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

export async function ensureMarketplaceDatabaseExists(): Promise<void> {
	const user = process.env.DB_USER;
	const pass = process.env.DB_PASS;
	const port = process.env.DB_PORT;
	const domain = process.env.DB_DOMAIN;
	const dbName = process.env.DB_MARKETPLACE_DATABASE;
	if (!user || !pass || !port || !domain || !dbName) {
		const missing = [
			!user && "DB_USER",
			!pass && "DB_PASS",
			!port && "DB_PORT",
			!domain && "DB_DOMAIN",
			!dbName && "DB_MARKETPLACE_DATABASE",
		]
			.filter(Boolean)
			.join(", ");
		throw new Error(`Missing required database env: ${missing}`);
	}
	const sqlClient = postgres({
		host: domain,
		port: Number(port),
		user,
		password: pass,
		database: "postgres",
	});
	try {
		await sqlClient.unsafe(`CREATE DATABASE "${dbName}"`);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("already exists")) {
			await sqlClient.end({ timeout: 5 });
			throw error;
		}
	}
	await sqlClient.end({ timeout: 5 });
}

export async function runMigrations(): Promise<void> {
	await migratePg(coreDb, { migrationsFolder: API_MIGRATIONS_PATH });
	await migratePg(marketplaceDb, {
		migrationsFolder: MARKETPLACE_MIGRATIONS_PATH,
	});
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
	const evyFlowsJson = evyFlowsRaw.map((f: unknown) => validateUiFlow(f));
	const serviceFlowsJson = serviceFlowsRaw.map((f: unknown) =>
		validateUiFlow(f),
	);
	const dataJson = validateSeedData(
		JSON.parse(await readFile(paths.dataPath ?? DATA_PATH, "utf-8")),
	);

	return { evyFlowsJson, serviceFlowsJson, dataJson };
}

export async function seedDatabase({
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
			`Seeding non-marketplace catalog keys into the API database is not implemented (got: ${Object.keys(evyDataJson).join(", ")}). Add dedicated-table inserts for Service, Organization, or ServiceProvider if needed.`,
		);
	}

	await coreDb.transaction(async (tx) => {
		await tx.delete(coreSchema.flow);
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
		partitionSeedCatalogData(dataJson);
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
	main()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error("Seeding failed:", error);
			process.exit(1);
		});
}
