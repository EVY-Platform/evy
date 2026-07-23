/// <reference types="bun-types" />

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate as migratePg } from "drizzle-orm/bun-sql/migrator";
import { data as marketplaceDataTable } from "../services/marketplace/src/schema";
import { getPostgresConnectionUrl, requireEnv } from "../types/env";
import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	DATA_EVY_RowData,
	UI_Page,
	UI_Row,
} from "../types/generated/ts";
import { EVY_CORE_SERVICE } from "../types/generated/ts/coreResources";
import {
	address as addressTable,
	file as fileTable,
	flow as flowTable,
	organization as organizationTable,
	page as pageTable,
	row as rowTable,
	serviceProvider as serviceProviderTable,
	serviceResource as serviceResourceTable,
	service as serviceTable,
} from "../types/generated/ts/db/schema.generated";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "../types/generated/ts/marketplaceResources";
import { validateUiFlow } from "../types/validators";
import { copySeedFileBinaries } from "./seed-files";

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
const FIXTURES_PATH = join(SCRIPT_DIR, "fixtures");
const EVY_FLOWS_PATH = join(FIXTURES_PATH, "evy", "evy_sdui.json");
const SERVICE_FLOWS_PATH = join(FIXTURES_PATH, "services", "service_sdui.json");
const DATA_PATH = join(FIXTURES_PATH, "services", "service_data.json");
const SEED_FILES_PATH = join(FIXTURES_PATH, "services", "seed-files");
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

const coreSchema = {
	organization: organizationTable,
	service: serviceTable,
	serviceProvider: serviceProviderTable,
	serviceResource: serviceResourceTable,
	flow: flowTable,
	page: pageTable,
	row: rowTable,
	file: fileTable,
	address: addressTable,
};
const marketplaceSchema = { data: marketplaceDataTable };

const coreSqlClient = new SQL(getPostgresConnectionUrl("DB_EVY_DATABASE"));
const marketplaceSqlClient = new SQL(
	getPostgresConnectionUrl("DB_MARKETPLACE_DATABASE"),
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
	coreFlowsResource: "d23cd318-3df4-486f-92d8-77f84402e63c",
	corePagesResource: "fbfdc3be-6a88-4f1a-a72a-cd49de3f9629",
	coreRowsResource: "7c2d2ca4-9b1a-469f-a5df-39800357f79f",
	coreDevicesResource: "a7198f1b-7ff9-44e1-b1c1-da491c59aca4",
	coreOrganisationsResource: "584098b1-811f-4563-a6f0-e7669e884cdc",
	coreServicesResource: "8eccd82c-dd04-4cc7-b588-e64d36d3f27b",
	coreProvidersResource: "136d5d53-af3b-4fe1-954c-46df6c9f9ec3",
	coreServiceResourcesResource: "58e2e69d-78ba-4657-b991-cc6a5e0c80c9",
	coreFilesResource: "996738e6-15eb-4f3e-8f97-7538a1e2635c",
	coreAddressesResource: "eef0b91c-f8f6-4603-b082-1211650af931",
} as const;

// Fixture keys are the lowercase forms of the generated resource constants
// (selling_reasons -> SELLING_REASONS), so derive the map instead of
// restating every resource.
const MARKETPLACE_SEED_RESOURCE_KEY_TO_ID: Record<string, string> =
	Object.fromEntries(
		Object.entries(MARKETPLACE_RESOURCE).map(([key, id]) => [
			key.toLowerCase(),
			id,
		]),
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

type SeedAddressRow = {
	id: string;
	unit?: string;
	street?: string;
	city?: string;
	postcode?: string;
	state?: string;
	country?: string;
	latitude?: number;
	longitude?: number;
	instructions?: string;
	createdAt: string;
	updatedAt: string;
};

function optionalStringField(
	item: SeedDataItem,
	key: string,
): string | undefined {
	const value = item[key];
	return typeof value === "string" ? value : undefined;
}

function optionalNumberField(
	item: SeedDataItem,
	key: string,
): number | undefined {
	const value = item[key];
	return typeof value === "number" ? value : undefined;
}

function buildAddressRows(
	addresses: SeedDataItem[],
	now: string,
): SeedAddressRow[] {
	return addresses.map((item) => {
		const createdAt =
			typeof item.createdAt === "string" ? item.createdAt : now;
		const updatedAt =
			typeof item.updatedAt === "string" ? item.updatedAt : now;
		const unit = optionalStringField(item, "unit");
		const street = optionalStringField(item, "street");
		const city = optionalStringField(item, "city");
		const postcode = optionalStringField(item, "postcode");
		const state = optionalStringField(item, "state");
		const country = optionalStringField(item, "country");
		const latitude = optionalNumberField(item, "latitude");
		const longitude = optionalNumberField(item, "longitude");
		const instructions = optionalStringField(item, "instructions");
		return {
			id: item.id,
			...(unit !== undefined ? { unit } : {}),
			...(street !== undefined ? { street } : {}),
			...(city !== undefined ? { city } : {}),
			...(postcode !== undefined ? { postcode } : {}),
			...(state !== undefined ? { state } : {}),
			...(country !== undefined ? { country } : {}),
			...(latitude !== undefined ? { latitude } : {}),
			...(longitude !== undefined ? { longitude } : {}),
			...(instructions !== undefined ? { instructions } : {}),
			createdAt,
			updatedAt,
		};
	});
}

function timestamped(now: string): { createdAt: string; updatedAt: string } {
	return { createdAt: now, updatedAt: now };
}

type DecomposedFlow = {
	flowRow: DATA_EVY_Flow;
	pageRows: DATA_EVY_Page[];
	rowRows: DATA_EVY_Row[];
};

function decomposeFlow(flow: SeedFlow, now: string): DecomposedFlow {
	const rowRows: DATA_EVY_Row[] = [];
	const pageRows = flow.pages.map((page) =>
		decomposePage(page, rowRows, now),
	);
	return {
		flowRow: {
			id: flow.id,
			name: flow.name,
			pageIds: pageRows.map((page) => page.id),
			...timestamped(now),
		},
		pageRows,
		rowRows,
	};
}

function decomposePage(
	page: UI_Page,
	rowRows: DATA_EVY_Row[],
	now: string,
): DATA_EVY_Page {
	return {
		id: page.id,
		name: page.name,
		title: page.title,
		rowIds: page.rows.map((row) => decomposeRow(row, rowRows, now)),
		footerRowId: page.footer
			? decomposeRow(page.footer, rowRows, now)
			: undefined,
		...timestamped(now),
	};
}

function isUiRow(value: unknown): value is UI_Row {
	return (
		value !== null &&
		typeof value === "object" &&
		"id" in value &&
		"type" in value &&
		"title" in value &&
		"visible" in value
	);
}

function isRowDataValue(value: unknown): value is DATA_EVY_RowData[string] {
	return (
		value === null ||
		["string", "number", "boolean"].includes(typeof value) ||
		(typeof value === "object" && value !== null)
	);
}

function decomposeRow(
	uiRow: UI_Row,
	rowRows: DATA_EVY_Row[],
	now: string,
): string {
	const data: DATA_EVY_RowData = {};
	for (const [key, value] of Object.entries(uiRow)) {
		if (
			[
				"id",
				"name",
				"type",
				"visible",
				"child",
				"children",
				"sheet",
			].includes(key)
		) {
			continue;
		}
		if (value !== undefined && isRowDataValue(value)) {
			data[key] = value;
		}
	}
	const sheetRow = uiRow.sheet;
	if (sheetRow !== undefined) {
		if (!isUiRow(sheetRow)) {
			throw new Error(`Row ${uiRow.id} has an invalid sheet row`);
		}
		data.sheet_row_id = decomposeRow(sheetRow, rowRows, now);
	}

	const childRow = uiRow.child;
	if (childRow !== undefined) {
		if (!isUiRow(childRow)) {
			throw new Error(`Row ${uiRow.id} has an invalid child row`);
		}
		data.child_row_id = decomposeRow(childRow, rowRows, now);
	}

	const childRows = uiRow.children;
	if (childRows !== undefined) {
		if (!Array.isArray(childRows) || !childRows.every(isUiRow)) {
			throw new Error(`Row ${uiRow.id} has invalid children rows`);
		}
		if (childRows.length > 0) {
			data.children_row_ids = childRows.map((child) =>
				decomposeRow(child, rowRows, now),
			);
		}
	}
	rowRows.push({
		id: uiRow.id,
		name: uiRow.name,
		type: uiRow.type,
		visible: uiRow.visible || "true",
		data,
		...timestamped(now),
	});
	return uiRow.id;
}

// Seeded ServiceResource row names are snake_case singulars. Note this
// diverges from core.resources.json's "serviceResource" singular; nothing
// consumes either value programmatically today, so the seeded names are
// kept stable for existing data.
const SERVICE_RESOURCE_SPECS: [string, string, string][] = [
	[SEED_IDS.coreFlowsResource, EVY_CORE_SERVICE, "flow"],
	[SEED_IDS.corePagesResource, EVY_CORE_SERVICE, "page"],
	[SEED_IDS.coreRowsResource, EVY_CORE_SERVICE, "row"],
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
	[SEED_IDS.coreAddressesResource, EVY_CORE_SERVICE, "address"],
	[
		MARKETPLACE_RESOURCE.SELLING_REASONS,
		MARKETPLACE_SERVICE,
		"selling_reason",
	],
	[MARKETPLACE_RESOURCE.CONDITIONS, MARKETPLACE_SERVICE, "condition"],
	[MARKETPLACE_RESOURCE.DURATIONS, MARKETPLACE_SERVICE, "duration"],
	[MARKETPLACE_RESOURCE.AREAS, MARKETPLACE_SERVICE, "area"],
	[MARKETPLACE_RESOURCE.ITEMS, MARKETPLACE_SERVICE, "item"],
	[MARKETPLACE_RESOURCE.MESSAGES, MARKETPLACE_SERVICE, "message"],
];

function buildServiceResourceRows(now: string) {
	return SERVICE_RESOURCE_SPECS.map(([id, fkServiceId, name]) => ({
		id,
		fkServiceId,
		name,
		...timestamped(now),
	}));
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
	const {
		files: evyFiles = [],
		addresses: evyAddresses = [],
		...unsupportedEvy
	} = evyDataJson;
	const unsupportedResources = Object.keys(unsupportedEvy);
	if (unsupportedResources.length > 0) {
		throw new Error(
			`Seeding non-marketplace resources into the API database is not implemented (got: ${unsupportedResources.join(", ")}). Add dedicated-table inserts for Service, Organization, or ServiceProvider if needed.`,
		);
	}

	const fileRows = buildFileRows(evyFiles, now);
	const addressRows = buildAddressRows(evyAddresses, now);
	await copySeedFileBinaries({
		files: fileRows,
		repoRoot: REPO_ROOT,
		seedFilesPath: SEED_FILES_PATH,
		runtimeFilesPath: RUNTIME_FILES_PATH,
		apiDockerService: API_DOCKER_SERVICE,
		apiContainerFilesDir: API_CONTAINER_FILES_DIR,
	});

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

		await tx.delete(coreSchema.row);
		await tx.delete(coreSchema.page);
		await tx.delete(coreSchema.flow);
		const decomposedFlows = [...evyFlowsJson, ...serviceFlowsJson].map(
			(flowData) => decomposeFlow(flowData, now),
		);
		const rowRows = decomposedFlows.flatMap((flowData) => flowData.rowRows);
		const pageRows = decomposedFlows.flatMap(
			(flowData) => flowData.pageRows,
		);
		const flowRows = decomposedFlows.map((flowData) => flowData.flowRow);
		if (rowRows.length > 0) {
			await tx.insert(coreSchema.row).values(rowRows);
		}
		if (pageRows.length > 0) {
			await tx.insert(coreSchema.page).values(pageRows);
		}
		if (flowRows.length > 0) {
			await tx.insert(coreSchema.flow).values(flowRows);
		}

		await tx.delete(coreSchema.file);
		if (fileRows.length > 0) {
			await tx.insert(coreSchema.file).values(fileRows);
		}

		await tx.delete(coreSchema.address);
		if (addressRows.length > 0) {
			await tx.insert(coreSchema.address).values(addressRows);
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
