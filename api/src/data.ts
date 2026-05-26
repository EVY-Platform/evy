import { and, asc, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type {
	DATA_EVY_Organization,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
	GetResponse,
	GetRequest,
	OS,
	CreateRequest,
	CreateResponse,
	UpdateRequest,
	UpdateResponse,
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
import { emitDataChangedNotification } from "./notifications";
import {
	EVY_CORE_SERVICE,
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAME_SET,
} from "evy-types/coreResources";
import {
	validateDataEvyOrganization as validateOrganizationPayload,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
	validateGetResponse,
	validateUiFlow as validateFlowData,
	validateCreateResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import {
	buildCollectionResponseEnvelope,
	buildSingleResponseEnvelope,
} from "evy-types/rpcResponseHelpers";

const evyCoreResourceNameSet: ReadonlySet<string> = EVY_CORE_RESOURCE_NAME_SET;

const connectionString = getConnectionUrl();
const client = postgres(connectionString);

let db = drizzle(client, { schema });

function buildGetResponse(items: unknown[]): GetResponse {
	return validateGetResponse(buildCollectionResponseEnvelope(items));
}

function buildCreateResponse(item: CreateResponse["data"]): CreateResponse {
	return validateCreateResponse(buildSingleResponseEnvelope(item));
}

function buildUpdateResponse(item: UpdateResponse["data"]): UpdateResponse {
	return validateUpdateResponse(buildSingleResponseEnvelope(item));
}

export function setDbForTest(database: typeof db): void {
	db = database;
}

function assertEvyCoreAccess(
	params: GetRequest | CreateRequest | UpdateRequest,
): void {
	if (params.service !== EVY_CORE_SERVICE) {
		throw new Error("Core API only serves service evy");
	}
	if (!evyCoreResourceNameSet.has(params.resource)) {
		throw new Error("Resource is not served by the core API");
	}
}

export async function get(params: GetRequest): Promise<GetResponse> {
	assertEvyCoreAccess(params);
	return getCoreBody(params);
}

export async function create(params: CreateRequest): Promise<CreateResponse> {
	assertEvyCoreAccess(params);
	return createCoreBody(params);
}

export async function update(params: UpdateRequest): Promise<UpdateResponse> {
	assertEvyCoreAccess(params);
	return updateCoreBody(params);
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
	mapRow: (row: unknown) => CreateResponse["data"];
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
		? await base
				.where(and(...whereClauses))
				.orderBy(asc(table.updatedAt), asc(table.id))
		: await base.orderBy(asc(table.updatedAt), asc(table.id));
	const mapped = rows.map((r) => mapRow(r as TRow));
	return buildGetResponse(mapped);
}

async function insertCatalogEntity<TSelect>(
	doInsert: () => Promise<TSelect[]>,
	mapRow: (row: TSelect) => CreateResponse["data"],
): Promise<CreateResponse> {
	const inserted = await doInsert();
	return buildCreateResponse(mapRow(inserted[0]));
}

async function updateCatalogEntity<TSelect>(
	filterId: string,
	doUpdate: (filterId: string) => Promise<TSelect[]>,
	mapRow: (row: TSelect) => UpdateResponse["data"],
): Promise<UpdateResponse> {
	const updated = await doUpdate(filterId);
	if (updated.length === 0) {
		throw new Error("Resource not found");
	}
	return buildUpdateResponse(mapRow(updated[0]));
}

async function insertCatalogEntityFromConfig<TValidated>(
	config: CatalogEntityConfig<TValidated>,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter?.id;

	const response = await insertCatalogEntity(
		() =>
			// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
			(db.insert(config.table as any) as any)
				.values(config.toInsertValues(validated, nowIso, filterId))
				.returning(),
		(row) => config.mapRow(row),
	);

	notify(response.data);
	return response;
}

async function updateCatalogEntityFromConfig<TValidated>(
	config: CatalogEntityConfig<TValidated>,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter.id;

	const response = await updateCatalogEntity(
		filterId,
		(updateFilterId) =>
			// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
			(db.update(config.table as any) as any)
				.set(config.toUpdateSet(validated, nowIso))
				.where(eq(config.table.id, updateFilterId))
				.returning(),
		(row) => config.mapRow(row),
	);

	notify(response.data);
	return response;
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

	if (resource === EVY_CORE_RESOURCE.DEVICES) {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		const base = db.select({ data: flow.data }).from(flow);
		const whereClauses = [];

		if (filter?.id) {
			whereClauses.push(eq(flow.id, filter.id));
		}
		if (filter?.updatedAfter) {
			whereClauses.push(gt(flow.updatedAt, filter.updatedAfter));
		}

		const rows = whereClauses.length
			? await base
					.where(and(...whereClauses))
					.orderBy(asc(flow.updatedAt), asc(flow.id))
			: await base.orderBy(asc(flow.updatedAt), asc(flow.id));
		const payload = rows.map((f) => f.data);
		for (const item of payload) {
			validateFlowData(item);
		}
		return buildGetResponse(payload);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return listCoreCatalogRows(service, filter, mapServiceRow);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return listCoreCatalogRows(organization, filter, (r) => r);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return listCoreCatalogRows(serviceProvider, filter, (r) => r);
	}

	throw new Error("Unsupported resource for core API");
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
	mapRow: (row: unknown) => row as DATA_EVY_Organization,
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
	mapRow: (row: unknown) => row as DATA_EVY_ServiceProvider,
};

async function createCoreBody(params: CreateRequest): Promise<CreateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	function emitNotification(value: unknown): void {
		emitDataChangedNotification({
			service: EVY_CORE_SERVICE,
			resource,
			operation: "create",
			value,
		});
	}

	if (resource === EVY_CORE_RESOURCE.DEVICES) {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		const validatedData = validateFlowData(dataPayload);
		const filterId = filter?.id;
		const persistedFlowData =
			filterId && filterId !== validatedData.id
				? { ...validatedData, id: filterId }
				: validatedData;

		const result = await db
			.insert(flow)
			.values({
				id: persistedFlowData.id,
				data: persistedFlowData,
				createdAt: nowIso,
				updatedAt: nowIso,
			})
			.returning()
			.catch((err) => {
				if (err?.code === "23505") {
					throw new Error("Resource already exists");
				}
				throw err;
			});
		const response = buildCreateResponse(result[0]);
		emitNotification(persistedFlowData);
		return response;
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return insertCatalogEntityFromConfig(
			serviceCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return insertCatalogEntityFromConfig(
			organizationCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return insertCatalogEntityFromConfig(
			providerCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	throw new Error("Unsupported resource for core API");
}

async function updateCoreBody(params: UpdateRequest): Promise<UpdateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	function emitNotification(value: unknown): void {
		emitDataChangedNotification({
			service: EVY_CORE_SERVICE,
			resource,
			operation: "update",
			value,
		});
	}

	if (resource === EVY_CORE_RESOURCE.DEVICES) {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		const validatedData = validateFlowData(dataPayload);
		const filterId = filter.id;
		const persistedFlowData =
			filterId !== validatedData.id
				? { ...validatedData, id: filterId }
				: validatedData;

		const result = await db
			.update(flow)
			.set({ data: persistedFlowData, updatedAt: nowIso })
			.where(eq(flow.id, filterId))
			.returning();
		if (result.length === 0) {
			throw new Error("Resource not found");
		}
		const response = buildUpdateResponse(result[0]);
		emitNotification(persistedFlowData);
		return response;
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return updateCatalogEntityFromConfig(
			serviceCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return updateCatalogEntityFromConfig(
			organizationCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return updateCatalogEntityFromConfig(
			providerCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	throw new Error("Unsupported resource for core API");
}
