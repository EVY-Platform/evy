/// <reference types="bun-types" />

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate as migratePg } from "drizzle-orm/bun-sql/migrator";
import { MARKETPLACE_SERVICE_DESCRIPTOR } from "../services/marketplace/src/resources";
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
	formatter as formatterTable,
	message as messageTable,
	organization as organizationTable,
	page as pageTable,
	row as rowTable,
	serviceProvider as serviceProviderTable,
	service as serviceTable,
} from "../types/generated/ts/db/schema.generated";
import { STANDARD_FORMATTERS } from "../types/standardFormatters";
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
	flow: flowTable,
	page: pageTable,
	row: rowTable,
	file: fileTable,
	address: addressTable,
	formatter: formatterTable,
	message: messageTable,
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
} as const;

const MARKETPLACE_SERVICE = MARKETPLACE_SERVICE_DESCRIPTOR.id;

const MARKETPLACE_SEED_RESOURCE_KEY_TO_ID: Record<string, string> =
	Object.fromEntries(
		MARKETPLACE_SERVICE_DESCRIPTOR.resources.map((resource) => [
			resource.name,
			resource.id,
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
	visibility: "public" | "private";
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
		const { createdAt, updatedAt } = seedTimestamps(item, now);
		return {
			id: item.id,
			type: item.type,
			visibility: "public",
			createdAt,
			updatedAt,
		};
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
	visibility: "public" | "private";
	createdAt: string;
	updatedAt: string;
};

function buildAddressRows(
	addresses: SeedDataItem[],
	now: string,
): SeedAddressRow[] {
	const stringKeys = [
		"unit",
		"street",
		"city",
		"postcode",
		"state",
		"country",
		"instructions",
	] as const;
	const numberKeys = ["latitude", "longitude"] as const;
	return addresses.map((item) => {
		const { createdAt, updatedAt } = seedTimestamps(item, now);
		const optionalStrings = Object.fromEntries(
			stringKeys
				.filter((key) => typeof item[key] === "string")
				.map((key) => [key, item[key] as string]),
		);
		const optionalNumbers = Object.fromEntries(
			numberKeys
				.filter((key) => typeof item[key] === "number")
				.map((key) => [key, item[key] as number]),
		);
		return {
			id: item.id,
			...optionalStrings,
			...optionalNumbers,
			visibility:
				item.visibility === "private" || item.visibility === "public"
					? item.visibility
					: "private",
			createdAt,
			updatedAt,
		};
	});
}

function seedTimestamps(
	item: SeedDataItem,
	now: string,
): { createdAt: string; updatedAt: string } {
	return {
		createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
		updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
	};
}

function timestamped(now: string): { createdAt: string; updatedAt: string } {
	return { createdAt: now, updatedAt: now };
}

function buildFormatterRows(now: string) {
	return STANDARD_FORMATTERS.map((formatter) => ({
		...formatter,
		...timestamped(now),
	}));
}

type SeedMessageRow = {
	id: string;
	fk: string;
	service: string;
	resource: string;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	status: "pending" | "accepted";
	data: Record<string, unknown>;
	visibility: "public" | "private";
};

function buildMessageRows(
	messages: SeedDataItem[],
	now: string,
): SeedMessageRow[] {
	return messages.map((item) => {
		const { createdAt, updatedAt } = seedTimestamps(item, now);
		if (typeof item.fk !== "string") {
			throw new Error(
				`Seed message "${item.id}" must have a string "fk" field`,
			);
		}
		if (typeof item.service !== "string") {
			throw new Error(
				`Seed message "${item.id}" must have a string "service" field`,
			);
		}
		if (typeof item.resource !== "string") {
			throw new Error(
				`Seed message "${item.id}" must have a string "resource" field`,
			);
		}
		if (item.status !== "pending" && item.status !== "accepted") {
			throw new Error(
				`Seed message "${item.id}" must have status "pending" or "accepted"`,
			);
		}
		const data =
			item.data !== null &&
			typeof item.data === "object" &&
			!Array.isArray(item.data)
				? (item.data as Record<string, unknown>)
				: {};
		return {
			id: item.id,
			fk: item.fk,
			service: item.service,
			resource: item.resource,
			archivedAt:
				item.archivedAt === null || typeof item.archivedAt === "string"
					? (item.archivedAt ?? null)
					: null,
			createdAt,
			updatedAt,
			status: item.status,
			data,
			visibility:
				item.visibility === "private" || item.visibility === "public"
					? item.visibility
					: "private",
		};
	});
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
			...(flow.submits ? { submits: flow.submits } : {}),
			visibility: "public",
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
		visibility: "public",
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
		visibility: "public",
		...timestamped(now),
	});
	return uiRow.id;
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
		messages: evyMessages = [],
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
	const messageRows = buildMessageRows(evyMessages, now);
	const formatterRows = buildFormatterRows(now);
	await copySeedFileBinaries({
		files: fileRows,
		repoRoot: REPO_ROOT,
		seedFilesPath: SEED_FILES_PATH,
		runtimeFilesPath: RUNTIME_FILES_PATH,
		apiDockerService: API_DOCKER_SERVICE,
		apiContainerFilesDir: API_CONTAINER_FILES_DIR,
	});

	await coreDb.transaction(async (tx) => {
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
			visibility: "public",
			...timestamped(now),
		});

		await tx.insert(coreSchema.service).values([
			{
				id: EVY_CORE_SERVICE,
				name: "evy",
				description: "EVY core service",
				sortOrder: 0,
				visibility: "public",
				...timestamped(now),
			},
			{
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				description: "Marketplace service",
				sortOrder: 1,
				visibility: "public",
				// Records the endpoint on the row when the environment knows it,
				// so routing does not depend on the env convention at runtime.
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
			visibility: "public",
			...timestamped(now),
		});

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

		await tx.delete(coreSchema.message);
		if (messageRows.length > 0) {
			await tx.insert(coreSchema.message).values(messageRows);
		}

		await tx.delete(coreSchema.formatter);
		if (formatterRows.length > 0) {
			await tx.insert(coreSchema.formatter).values(formatterRows);
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
