/// <reference types="bun-types" />

import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate as migratePg } from "drizzle-orm/bun-sql/migrator";
import { jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { EVY_CORE_SERVICE } from "../types/generated/ts/coreResources";
import {
	file as fileTable,
	flow as flowTable,
	organization as organizationTable,
	serviceProvider as serviceProviderTable,
	serviceResource as serviceResourceTable,
	service as serviceTable,
} from "../types/generated/ts/db/schema.generated";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "../types/generated/ts/marketplaceResources";
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
const REPO_ROOT = join(SCRIPT_DIR, "..");
const EVY_FLOWS_PATH = join(REPO_ROOT, "docs", "evy", "evy_sdui.json");
const SERVICE_FLOWS_PATH = join(
	REPO_ROOT,
	"docs",
	"services",
	"service_sdui.json",
);
const DATA_PATH = join(REPO_ROOT, "docs", "services", "service_data.json");
const SEED_FILES_PATH = join(REPO_ROOT, "docs", "services", "seed-files");
const RUNTIME_FILES_PATH = join(REPO_ROOT, "api", "src", "public", "files");
const API_MIGRATIONS_PATH = join(REPO_ROOT, "api", "drizzle");
const MARKETPLACE_MIGRATIONS_PATH = join(
	REPO_ROOT,
	"services",
	"marketplace",
	"drizzle",
);

const API_DOCKER_SERVICE = "api";
const API_CONTAINER_FILES_DIR = "/app/api/src/public/files";

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

const marketplaceDataTable = pgTable("Data", {
	id: uuid("id").primaryKey().defaultRandom(),
	resource: varchar("resource", { length: 50 }).notNull(),
	data: jsonb("data").$type<SeedDataItem>().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

const coreSchema = {
	organization: organizationTable,
	service: serviceTable,
	serviceProvider: serviceProviderTable,
	serviceResource: serviceResourceTable,
	flow: flowTable,
	file: fileTable,
};
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

const SEED_IDS = {
	evyOrganization: "09f07052-c27c-4116-a508-a2bcb074c827",
	evyMarketplaceProvider: "be00fb53-80e9-4a09-a43f-4588b4ffc851",
	logo: "ec3a7609-e2bc-484e-aab1-acef6777595c",
	coreSduiResource: "d23cd318-3df4-486f-92d8-77f84402e63c",
	coreDevicesResource: "a7198f1b-7ff9-44e1-b1c1-da491c59aca4",
	coreOrganisationsResource: "584098b1-811f-4563-a6f0-e7669e884cdc",
	coreServicesResource: "8eccd82c-dd04-4cc7-b588-e64d36d3f27b",
	coreProvidersResource: "136d5d53-af3b-4fe1-954c-46df6c9f9ec3",
	coreServiceResourcesResource: "58e2e69d-78ba-4657-b991-cc6a5e0c80c9",
	coreFilesResource: "996738e6-15eb-4f3e-8f97-7538a1e2635c",
} as const;

const MARKETPLACE_SEED_RESOURCE_KEY_TO_ID = {
	selling_reasons: MARKETPLACE_RESOURCE.SELLING_REASONS,
	conditions: MARKETPLACE_RESOURCE.CONDITIONS,
	durations: MARKETPLACE_RESOURCE.DURATIONS,
	areas: MARKETPLACE_RESOURCE.AREAS,
	items: MARKETPLACE_RESOURCE.ITEMS,
} as const;

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
		if (resource in MARKETPLACE_SEED_RESOURCE_KEY_TO_ID) {
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

function buildDataRows(
	dataJson: SeedDataMap,
	now: string,
	resourceKeyToId: Partial<Record<string, string>> = {},
): SeedDataRow[] {
	const rows: SeedDataRow[] = [];
	for (const [resource, value] of Object.entries(dataJson)) {
		const rowResource = resourceKeyToId[resource] ?? resource;
		for (const item of value) {
			rows.push({
				id: item.id,
				resource: rowResource,
				data: item,
				createdAt: now,
				updatedAt: now,
			});
		}
	}
	return rows;
}

type SeedFileRow = {
	id: string;
	type: string;
	createdAt: string;
	updatedAt: string;
};

function buildFileRows(files: SeedDataItem[], now: string): SeedFileRow[] {
	return files.map((item) => {
		if (typeof item.type !== "string" || item.type.length === 0) {
			throw new Error(
				`Seed file "${item.id}" must have a non-empty string "type" field`,
			);
		}
		const createdAt =
			typeof item.createdAt === "string" ? item.createdAt : now;
		const updatedAt =
			typeof item.updatedAt === "string" ? item.updatedAt : now;
		return { id: item.id, type: item.type, createdAt, updatedAt };
	});
}

function timestamped(now: string): { createdAt: string; updatedAt: string } {
	return { createdAt: now, updatedAt: now };
}

const SERVICE_RESOURCE_SPECS: [string, string, string][] = [
	[SEED_IDS.coreSduiResource, EVY_CORE_SERVICE, "flow"],
	[SEED_IDS.coreDevicesResource, EVY_CORE_SERVICE, "device"],
	[SEED_IDS.coreOrganisationsResource, EVY_CORE_SERVICE, "organisation"],
	[SEED_IDS.coreServicesResource, EVY_CORE_SERVICE, "service"],
	[SEED_IDS.coreProvidersResource, EVY_CORE_SERVICE, "provider"],
	[
		SEED_IDS.coreServiceResourcesResource,
		EVY_CORE_SERVICE,
		"service_resource",
	],
	[SEED_IDS.coreFilesResource, EVY_CORE_SERVICE, "file"],
	[
		MARKETPLACE_RESOURCE.SELLING_REASONS,
		MARKETPLACE_SERVICE,
		"selling_reason",
	],
	[MARKETPLACE_RESOURCE.CONDITIONS, MARKETPLACE_SERVICE, "condition"],
	[MARKETPLACE_RESOURCE.DURATIONS, MARKETPLACE_SERVICE, "duration"],
	[MARKETPLACE_RESOURCE.AREAS, MARKETPLACE_SERVICE, "area"],
	[MARKETPLACE_RESOURCE.ITEMS, MARKETPLACE_SERVICE, "item"],
];

function buildServiceResourceRows(now: string) {
	return SERVICE_RESOURCE_SPECS.map(([id, fkServiceId, name]) => ({
		id,
		fkServiceId,
		name,
		...timestamped(now),
	}));
}

async function runCommand(
	command: string[],
): Promise<{ ok: boolean; stderr: string }> {
	try {
		const proc = Bun.spawn(command, {
			cwd: REPO_ROOT,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stderr = await new Response(proc.stderr).text();
		await proc.exited;
		return { ok: proc.exitCode === 0, stderr };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, stderr: message };
	}
}

async function isApiContainerRunning(): Promise<boolean> {
	try {
		const proc = Bun.spawn(
			["docker", "compose", "ps", "-q", API_DOCKER_SERVICE],
			{ cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		return proc.exitCode === 0 && stdout.trim().length > 0;
	} catch {
		return false;
	}
}

async function copySeedFileBinaries(files: SeedFileRow[]): Promise<void> {
	if (files.length === 0) {
		return;
	}
	await mkdir(RUNTIME_FILES_PATH, { recursive: true });
	for (const fileRow of files) {
		const sourcePath = join(SEED_FILES_PATH, fileRow.id);
		try {
			await stat(sourcePath);
		} catch {
			throw new Error(
				`Missing seed binary for file "${fileRow.id}". Expected asset at ${sourcePath}.`,
			);
		}
		await copyFile(sourcePath, join(RUNTIME_FILES_PATH, fileRow.id));
	}

	// When the API runs in Docker, its file storage lives inside the container
	// rather than on the host, so seeded binaries are also copied in via
	// `docker compose cp`. Skipped when Docker is absent or no API container
	// is running (local Bun / --no-docker run).
	if (!(await isApiContainerRunning())) {
		return;
	}
	const mkdirResult = await runCommand([
		"docker",
		"compose",
		"exec",
		"-T",
		API_DOCKER_SERVICE,
		"mkdir",
		"-p",
		API_CONTAINER_FILES_DIR,
	]);
	if (!mkdirResult.ok) {
		throw new Error(
			`Failed to create file storage dir in API container: ${mkdirResult.stderr.trim()}`,
		);
	}
	for (const fileRow of files) {
		const copyResult = await runCommand([
			"docker",
			"compose",
			"cp",
			join(SEED_FILES_PATH, fileRow.id),
			`${API_DOCKER_SERVICE}:${API_CONTAINER_FILES_DIR}/${fileRow.id}`,
		]);
		if (!copyResult.ok) {
			throw new Error(
				`Failed to copy seed binary "${fileRow.id}" into API container: ${copyResult.stderr.trim()}`,
			);
		}
	}
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
	const { files: evyFiles = [], ...unsupportedEvy } = evyDataJson;
	const unsupportedResources = Object.keys(unsupportedEvy);
	if (unsupportedResources.length > 0) {
		throw new Error(
			`Seeding non-marketplace resources into the API database is not implemented (got: ${unsupportedResources.join(", ")}). Add dedicated-table inserts for Service, Organization, or ServiceProvider if needed.`,
		);
	}

	const fileRows = buildFileRows(evyFiles, now);
	await copySeedFileBinaries(fileRows);

	await coreDb.transaction(async (tx) => {
		await tx.delete(coreSchema.serviceResource);
		await tx.delete(coreSchema.serviceProvider);
		await tx.delete(coreSchema.organization);
		await tx.delete(coreSchema.service);

		await tx.insert(coreSchema.organization).values({
			id: SEED_IDS.evyOrganization,
			name: "evy",
			description: "EVY organization",
			logo: SEED_IDS.logo,
			url: "evy.local",
			supportEmail: "support@evy.local",
			...timestamped(now),
		});

		await tx.insert(coreSchema.service).values([
			{
				id: EVY_CORE_SERVICE,
				name: "evy",
				description: "EVY core service",
				sortOrder: 0,
				...timestamped(now),
			},
			{
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				description: "Marketplace service",
				sortOrder: 1,
				...timestamped(now),
			},
		]);

		await tx.insert(coreSchema.serviceProvider).values({
			id: SEED_IDS.evyMarketplaceProvider,
			fkServiceId: MARKETPLACE_SERVICE,
			fkOrganizationId: SEED_IDS.evyOrganization,
			name: "evy",
			description: "EVY marketplace provider",
			logo: SEED_IDS.logo,
			url: "evy.local",
			retired: false,
			...timestamped(now),
		});

		await tx
			.insert(coreSchema.serviceResource)
			.values(buildServiceResourceRows(now));

		await tx.delete(coreSchema.flow);
		const flowRows = [...evyFlowsJson, ...serviceFlowsJson].map(
			(flowData) => ({
				id: flowData.id,
				data: flowData,
				createdAt: now,
				updatedAt: now,
			}),
		);
		if (flowRows.length > 0) {
			await tx.insert(coreSchema.flow).values(flowRows);
		}

		await tx.delete(coreSchema.file);
		if (fileRows.length > 0) {
			await tx.insert(coreSchema.file).values(fileRows);
		}
	});

	const marketplaceRows = buildDataRows(
		marketplaceDataJson,
		now,
		MARKETPLACE_SEED_RESOURCE_KEY_TO_ID,
	);

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
