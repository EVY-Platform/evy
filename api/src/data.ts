import { and, desc, eq, gt } from "drizzle-orm";

import {
	type DATA_EVY_Service,
	type GetResponse,
	RESOURCES_BY_SERVICE,
	RESOURCE_VALUES,
	type GetRequest,
	type OS,
	type UpsertRequest,
	type UpsertResponse,
} from "evy-types";
import {
	device,
	flow,
	service,
	organization,
	serviceProvider,
	osEnum,
} from "./db/drizzleTables";
import { db } from "./db";
import {
	validateFlowData,
	validateOrganizationPayload,
	validateServicePayload,
	validateServiceProviderPayload,
} from "./validation";
import {
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import {
	validateGetResponse,
	validateUpsertResponse,
} from "evy-types/validators";

const CORE_SERVICE = "evy";

const CORE_API_RESOURCES = new Set(RESOURCES_BY_SERVICE.evy);

type Resource = GetRequest["resource"];

export function isResource(v: unknown): v is Resource {
	return typeof v === "string" && RESOURCE_VALUES.includes(v as Resource);
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

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
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
	doUpdate: () => Promise<TSelect[]>,
	doInsert: () => Promise<TSelect[]>,
	mapRow: (row: TSelect) => UpsertResponse,
): Promise<UpsertResponse> {
	if (filterId) {
		const updated = await doUpdate();
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

async function upsertCoreBody(params: UpsertRequest): Promise<UpsertResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	if (resource === "devices") {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === "sdui") {
		const validatedData = validateFlowData(dataPayload);
		const persistedFlowData =
			filter?.id && filter.id !== validatedData.id
				? { ...validatedData, id: filter.id }
				: validatedData;

		if (filter?.id) {
			const result = await db
				.update(flow)
				.set({ data: persistedFlowData, updatedAt: nowIso })
				.where(eq(flow.id, filter.id))
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
		const validated = validateServicePayload(dataPayload);
		const filterId = filter?.id;
		return upsertCatalogEntity(
			filterId,
			() =>
				filterId
					? db
							.update(service)
							.set({
								name: validated.name,
								description: validated.description,
								sortOrder: validated.sortOrder ?? null,
								defaultWeightKg: validated.defaultWeightKg ?? null,
								updatedAt: nowIso,
							})
							.where(eq(service.id, filterId))
							.returning()
					: Promise.resolve([]),
			() => {
				const insertValues: typeof service.$inferInsert = {
					id: validated.id,
					name: validated.name,
					description: validated.description,
					sortOrder: validated.sortOrder ?? null,
					defaultWeightKg: validated.defaultWeightKg ?? null,
					createdAt: validated.createdAt,
					updatedAt: nowIso,
				};
				if (filterId) {
					insertValues.id = filterId;
				}
				return db.insert(service).values(insertValues).returning();
			},
			mapServiceRow,
		);
	}

	if (resource === "organisations") {
		const validated = validateOrganizationPayload(dataPayload);
		const filterId = filter?.id;
		return upsertCatalogEntity(
			filterId,
			() =>
				filterId
					? db
							.update(organization)
							.set({
								name: validated.name,
								description: validated.description,
								logo: validated.logo,
								url: validated.url,
								supportEmail: validated.supportEmail,
								updatedAt: nowIso,
							})
							.where(eq(organization.id, filterId))
							.returning()
					: Promise.resolve([]),
			() => {
				const insertValues: typeof organization.$inferInsert = {
					id: validated.id,
					name: validated.name,
					description: validated.description,
					logo: validated.logo,
					url: validated.url,
					supportEmail: validated.supportEmail,
					createdAt: validated.createdAt,
					updatedAt: nowIso,
				};
				if (filterId) {
					insertValues.id = filterId;
				}
				return db.insert(organization).values(insertValues).returning();
			},
			(r) => r,
		);
	}

	if (resource === "providers") {
		const validated = validateServiceProviderPayload(dataPayload);
		const filterId = filter?.id;
		return upsertCatalogEntity(
			filterId,
			() =>
				filterId
					? db
							.update(serviceProvider)
							.set({
								fkServiceId: validated.fkServiceId,
								fkOrganizationId: validated.fkOrganizationId,
								name: validated.name,
								description: validated.description,
								logo: validated.logo,
								url: validated.url,
								retired: validated.retired,
								updatedAt: nowIso,
							})
							.where(eq(serviceProvider.id, filterId))
							.returning()
					: Promise.resolve([]),
			() => {
				const insertValues: typeof serviceProvider.$inferInsert = {
					id: validated.id,
					fkServiceId: validated.fkServiceId,
					fkOrganizationId: validated.fkOrganizationId,
					name: validated.name,
					description: validated.description,
					logo: validated.logo,
					url: validated.url,
					createdAt: validated.createdAt,
					updatedAt: nowIso,
					retired: validated.retired,
				};
				if (filterId) {
					insertValues.id = filterId;
				}
				return db.insert(serviceProvider).values(insertValues).returning();
			},
			(r) => r,
		);
	}

	throw new Error("Unsupported resource for core API");
}

export async function upsertCore(params: unknown): Promise<UpsertResponse> {
	validateCoreUpsertParams(params);
	return upsertCoreBody(params);
}
