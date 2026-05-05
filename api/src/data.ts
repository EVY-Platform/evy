import { and, desc, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type {
	DATA_EVY_Organization,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
	GetResponse,
	GetRequest,
	OS,
	UpsertRequest,
	UpsertResponse,
} from "evy-types";
import * as schema from "../../types/generated/ts/db/schema.generated";
import {
	device,
	flow,
	service,
	organization,
	serviceProvider,
	osEnum,
} from "../../types/generated/ts/db/schema.generated";
import { getConnectionUrl } from "./db";
import {
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import {
	validateDataEvyOrganization as validateOrganizationPayload,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
	validateGetResponse,
	validateUiFlow as validateFlowData,
	validateUpsertResponse,
} from "evy-types/validators";

const connectionString = getConnectionUrl();
const client = postgres(connectionString);

let db = drizzle(client, { schema });

export function setDbForTest(database: typeof db): void {
	db = database;
}

const CORE_SERVICE = "evy";

/** Resources served by the core EVY API. These are fixed and not dynamically discovered. */
const CORE_API_RESOURCES = new Set([
	"sdui",
	"devices",
	"organisations",
	"services",
	"providers",
]);

/**
 * Check whether a value is a valid resource string.
 * No longer validates against a generated constant list — accepts any
 * non-empty string, since resource validity is enforced at the registry level.
 */
export function isResource(v: unknown): v is string {
	return typeof v === "string" && v.length > 0;
}

function assertEvyCoreAccess(params: GetRequest | UpsertRequest): void {
	if (params.service !== CORE_SERVICE) {
		throw new Error("Core API only serves service evy");
	}
	if (!CORE_API_RESOURCES.has(params.resource)) {
		throw new Error("Resource is not served by the core API");
	}
}

function validateCoreGetParams(params: unknown): asserts params is GetRequest {
	validateStrictGetRequest(params);
	assertEvyCoreAccess(params);
}

function validateCoreUpsertParams(
	params: unknown,
): asserts params is UpsertRequest {
	validateStrictUpsertRequest(params);
	assertEvyCoreAccess(params);
}

/**
 * Core `get` handler after JSON-RPC shape checks. Callers must already have run
 * {@link validateStrictGetRequest}; this only applies evy-core access rules.
 */
export async function getCoreForValidatedRequest(
	params: GetRequest,
): Promise<GetResponse> {
	assertEvyCoreAccess(params);
	return getCoreBody(params);
}

/**
 * Core `upsert` handler after JSON-RPC shape checks. Callers must already have run
 * {@link validateStrictUpsertRequest}; this only applies evy-core access rules.
 */
export async function upsertCoreForValidatedRequest(
	params: UpsertRequest,
): Promise<UpsertResponse> {
	assertEvyCoreAccess(params);
	return upsertCoreBody(params);
}

function mapServiceRow(r: typeof service.$inferSelect): DATA_EVY_Service {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		...(r.sortOrder !== null ? { sortOrder: r.sortOrder } : {}),
		...(r.defaultWeightKg !== null
			? { defaultWeightKg: r.defaultWeightKg }
			: {}),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

type CatalogTable =
	| typeof service
	| typeof organization
	| typeof serviceProvider;

type CatalogEntityConfig<TValidated> = {
	table: CatalogTable;
	validate: (data: unknown) => TValidated;
	toUpdateSet: (
		validated: TValidated,
		nowIso: string,
	) => Record<string, unknown>;
	toInsertValues: (
		validated: TValidated,
		nowIso: string,
		filterId: string | undefined,
	) => Record<string, unknown>;
	mapRow: (row: unknown) => UpsertResponse;
};

async function listCoreCatalogRows<TRow>(
	table: CatalogTable,
	filter: GetRequest["filter"] | undefined,
	mapRow: (r: TRow) => unknown,
): Promise<GetResponse> {
	const base = db.select().from(table);
	const whereClauses = [];

	if (filter?.id) {
		whereClauses.push(eq(table.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(table.updatedAt, filter.updatedAfter));
	}

	const rows = whereClauses.length
		? await base.where(and(...whereClauses)).orderBy(desc(table.updatedAt))
		: await base.orderBy(desc(table.updatedAt));
	const mapped = rows.map((r) => mapRow(r as TRow));
	return validateGetResponse(mapped);
}

/**
 * Update by `filterId` when set; if no row matched (or no filter), insert. When
 * `filterId` is set and insert runs, `overrideInsertId` is applied to the insert row.
 */
async function upsertCatalogEntity<TSelect>(
	filterId: string | undefined,
	doUpdate: (filterId: string) => Promise<TSelect[]>,
	doInsert: () => Promise<TSelect[]>,
	mapRow: (row: TSelect) => UpsertResponse,
): Promise<UpsertResponse> {
	if (filterId) {
		const updated = await doUpdate(filterId);
		if (updated.length > 0) {
			const row = mapRow(updated[0]);
			validateUpsertResponse(row);
			return row;
		}
	}
	const inserted = await doInsert();
	const row = mapRow(inserted[0]);
	validateUpsertResponse(row);
	return row;
}

/**
 * Shared handler for catalog entity upserts (services, organisations, providers).
 * Validates, extracts filterId, then delegates to {@link upsertCatalogEntity}.
 */
async function upsertCatalogEntityFromConfig<TValidated>(
	config: CatalogEntityConfig<TValidated>,
	filter: UpsertRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
): Promise<UpsertResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter?.id;

	return upsertCatalogEntity(
		filterId,
		(updateFilterId) =>
			// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
			(db.update(config.table as any) as any)
				.set(config.toUpdateSet(validated, nowIso))
				.where(eq(config.table.id, updateFilterId))
				.returning(),
		() =>
			// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
			(db.insert(config.table as any) as any)
				.values(config.toInsertValues(validated, nowIso, filterId))
				.returning(),
		(row) => config.mapRow(row),
	);
}

export async function validateAuth(token: string, os: OS): Promise<boolean> {
	if (!token || token.length < 1) throw new Error("No token provided");
	if (!os || os.length < 1) throw new Error("No os provided");

	if (!osEnum.enumValues.includes(os)) return false;

	try {
		const existing = await db
			.select()
			.from(device)
			.where(eq(device.token, token))
			.limit(1);

		if (existing.length > 0) {
			return true;
		}

		await db.insert(device).values({
			token,
			os,
			createdAt: new Date().toISOString(),
		});

		return true;
	} catch (err) {
		console.warn("validateAuth: unexpected error", err);
		return false;
	}
}

async function getCoreBody(params: GetRequest): Promise<GetResponse> {
	const { resource, filter } = params;

	if (resource === "devices") {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === "sdui") {
		const base = db.select({ data: flow.data }).from(flow);
		const whereClauses = [];

		if (filter?.id) {
			whereClauses.push(eq(flow.id, filter.id));
		}
		if (filter?.updatedAfter) {
			whereClauses.push(gt(flow.updatedAt, filter.updatedAfter));
		}

		const rows = whereClauses.length
			? await base.where(and(...whereClauses)).orderBy(desc(flow.updatedAt))
			: await base.orderBy(desc(flow.updatedAt));
		const payload = rows.map((f) => f.data);
		for (const item of payload) {
			validateFlowData(item);
		}
		return validateGetResponse(payload);
	}

	if (resource === "services") {
		return listCoreCatalogRows(service, filter, mapServiceRow);
	}

	if (resource === "organisations") {
		return listCoreCatalogRows(organization, filter, (r) => r);
	}

	if (resource === "providers") {
		return listCoreCatalogRows(serviceProvider, filter, (r) => r);
	}

	throw new Error("Unsupported resource for core API");
}

export async function getCore(params: unknown): Promise<GetResponse> {
	validateCoreGetParams(params);
	return getCoreBody(params);
}

const serviceCatalogConfig: CatalogEntityConfig<DATA_EVY_Service> = {
	table: service,
	validate: validateServicePayload,
	toUpdateSet: (validated, nowIso) => ({
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
		defaultWeightKg: validated.defaultWeightKg ?? null,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
		defaultWeightKg: validated.defaultWeightKg ?? null,
		createdAt: validated.createdAt,
		updatedAt: nowIso,
	}),
	mapRow: (row: unknown) => mapServiceRow(row as typeof service.$inferSelect),
};

const organizationCatalogConfig: CatalogEntityConfig<DATA_EVY_Organization> = {
	table: organization,
	validate: validateOrganizationPayload,
	toUpdateSet: (validated, nowIso) => ({
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		supportEmail: validated.supportEmail,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		supportEmail: validated.supportEmail,
		createdAt: validated.createdAt,
		updatedAt: nowIso,
	}),
	mapRow: (row: unknown) => row as UpsertResponse,
};

const providerCatalogConfig: CatalogEntityConfig<DATA_EVY_ServiceProvider> = {
	table: serviceProvider,
	validate: validateServiceProviderPayload,
	toUpdateSet: (validated, nowIso) => ({
		fkServiceId: validated.fkServiceId,
		fkOrganizationId: validated.fkOrganizationId,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		retired: validated.retired,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		fkServiceId: validated.fkServiceId,
		fkOrganizationId: validated.fkOrganizationId,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		createdAt: validated.createdAt,
		updatedAt: nowIso,
		retired: validated.retired,
	}),
	mapRow: (row: unknown) => row as UpsertResponse,
};

async function upsertCoreBody(params: UpsertRequest): Promise<UpsertResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	if (resource === "devices") {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === "sdui") {
		const validatedData = validateFlowData(dataPayload);
		const filterId = filter?.id;
		const persistedFlowData =
			filterId && filterId !== validatedData.id
				? { ...validatedData, id: filterId }
				: validatedData;

		if (filterId) {
			const result = await db
				.update(flow)
				.set({ data: persistedFlowData, updatedAt: nowIso })
				.where(eq(flow.id, filterId))
				.returning();
			if (result.length > 0) {
				const row = result[0];
				validateUpsertResponse(row);
				return row;
			}
		}
		const result = await db
			.insert(flow)
			.values({
				id: persistedFlowData.id,
				data: persistedFlowData,
				createdAt: nowIso,
				updatedAt: nowIso,
			})
			.returning();
		const row = result[0];
		validateUpsertResponse(row);
		return row;
	}

	if (resource === "services") {
		return upsertCatalogEntityFromConfig(
			serviceCatalogConfig,
			filter,
			dataPayload,
			nowIso,
		);
	}

	if (resource === "organisations") {
		return upsertCatalogEntityFromConfig(
			organizationCatalogConfig,
			filter,
			dataPayload,
			nowIso,
		);
	}

	if (resource === "providers") {
		return upsertCatalogEntityFromConfig(
			providerCatalogConfig,
			filter,
			dataPayload,
			nowIso,
		);
	}

	throw new Error("Unsupported resource for core API");
}

export async function upsertCore(params: unknown): Promise<UpsertResponse> {
	validateCoreUpsertParams(params);
	return upsertCoreBody(params);
}
