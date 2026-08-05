import { and, asc, eq, gt, isNull } from "drizzle-orm";

import type {
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import { nowIso as clockNowIso } from "evy-types/clock";
import { hasDatabaseErrorCode, PG_UNIQUE_VIOLATION } from "evy-types/dbErrors";
import { assertResourceMutable } from "evy-types/resourceMutable";
import {
	assertIsoDateTimeJsonFields,
	validateCreateDataPayload,
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateUpdateDataPayload,
	validateUpdateResponse,
} from "evy-types/validators";
import { data, db, item_status_history } from "./db";
import {
	validateDataMarketplaceItem,
	validateDataMarketplaceLookup,
} from "./validation";

/** Drops null columns so an absent tombstone is omitted rather than null. */
function omitNulls<T extends Record<string, unknown>>(row: T): T {
	return Object.fromEntries(
		Object.entries(row).filter(([, value]) => value !== null),
	) as T;
}

import { emitDataChanged } from "./events";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SEED_RESOURCES,
	marketplaceResourceCatalogVisibility,
} from "./resources";

/**
 * Resource-specific payload validation. Every marketplace resource has a
 * schema: the core api forwards these payloads without inspecting them, so an
 * unvalidated resource here is an unvalidated resource everywhere.
 */
const RESOURCE_VALIDATORS: Record<string, (payload: unknown) => unknown> = {
	[MARKETPLACE_RESOURCE.ITEMS]: validateDataMarketplaceItem,
	[MARKETPLACE_RESOURCE.SELLING_REASONS]: validateDataMarketplaceLookup,
	[MARKETPLACE_RESOURCE.CONDITIONS]: validateDataMarketplaceLookup,
	[MARKETPLACE_RESOURCE.DURATIONS]: validateDataMarketplaceLookup,
	[MARKETPLACE_RESOURCE.AREAS]: validateDataMarketplaceLookup,
};

function assertResourcePayload(resource: string, payload: unknown): void {
	const validate = RESOURCE_VALIDATORS[resource];
	if (!validate) {
		// assertMarketplaceRules already rejected unknown resources, so this
		// means a resource was added to the manifest without a schema.
		throw new Error(
			`No payload schema for marketplace resource ${resource}`,
		);
	}
	validate(payload);
}

function assertMarketplaceRules(
	params: GetRequest | CreateRequest | UpdateRequest | DeleteRequest,
): void {
	if (!MARKETPLACE_SEED_RESOURCES.has(params.resource)) {
		throw new Error("Unsupported resource id for marketplace service");
	}
}

function assertMarketplaceResourceMutable(resource: string): void {
	assertResourceMutable(
		resource,
		marketplaceResourceCatalogVisibility(resource),
	);
}

async function getItemStatuses(params: GetRequest): Promise<GetResponse> {
	const { filter } = params;
	const whereClauses = [];
	if (filter?.id) {
		whereClauses.push(eq(item_status_history.id, filter.id));
	}
	if (filter?.updated_after) {
		whereClauses.push(
			gt(item_status_history.created_at, filter.updated_after),
		);
	}

	const rows = await db
		.select()
		.from(item_status_history)
		.where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
		.orderBy(
			asc(item_status_history.created_at),
			asc(item_status_history.id),
		);

	return validateGetResponse(rows);
}

export async function get(params: GetRequest): Promise<GetResponse> {
	assertMarketplaceRules(params);
	if (params.resource === MARKETPLACE_RESOURCE.ITEM_STATUSES) {
		return getItemStatuses(params);
	}

	const { resource, filter } = params;

	const whereClauses = [eq(data.resource, resource)];
	if (filter?.id) {
		whereClauses.push(eq(data.id, filter.id));
	}
	if (filter?.updated_after) {
		// Incremental reads carry tombstones; plain reads exclude them.
		whereClauses.push(gt(data.updated_at, filter.updated_after));
	} else {
		whereClauses.push(isNull(data.deleted_at));
	}

	const rows = await db
		.select({ data: data.data })
		.from(data)
		.where(and(...whereClauses))
		.orderBy(asc(data.updated_at), asc(data.id));

	return validateGetResponse(rows.map((r) => r.data));
}

export async function create(params: CreateRequest): Promise<CreateResponse> {
	assertMarketplaceRules(params);
	assertMarketplaceResourceMutable(params.resource);
	const { resource, filter, data: dataPayload } = params;
	const nowIso = clockNowIso();

	const validatedPayload = validateCreateDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);
	assertResourcePayload(resource, validatedPayload);

	const filterId = filter?.id;
	const insertValues: typeof data.$inferInsert = {
		resource,
		data: validatedPayload,
		created_at: nowIso,
		updated_at: nowIso,
	};
	if (filterId) {
		insertValues.id = filterId;
	}

	let result: (typeof data.$inferSelect)[];
	try {
		result = await db.insert(data).values(insertValues).returning();
	} catch (err: unknown) {
		if (hasDatabaseErrorCode(err, PG_UNIQUE_VIOLATION)) {
			throw new Error("Resource already exists");
		}
		throw err;
	}

	const row = result[0];
	const response = validateCreateResponse(omitNulls(row));
	emitDataChanged(resource, "create", row.data);
	return response;
}

export async function update(params: UpdateRequest): Promise<UpdateResponse> {
	assertMarketplaceRules(params);
	assertMarketplaceResourceMutable(params.resource);
	const { resource, filter, data: dataPayload } = params;
	const nowIso = clockNowIso();

	const validatedPayload = validateUpdateDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);
	assertResourcePayload(resource, validatedPayload);

	const result = await db
		.update(data)
		.set({ data: validatedPayload, updated_at: nowIso })
		.where(and(eq(data.id, filter.id), eq(data.resource, resource)))
		.returning();

	if (result.length === 0) {
		throw new Error("Resource not found");
	}

	const row = result[0];
	const response = validateUpdateResponse(omitNulls(row));
	emitDataChanged(resource, "update", row.data);
	return response;
}

export async function deleteResource(
	params: DeleteRequest,
): Promise<DeleteResponse> {
	assertMarketplaceRules(params);
	assertMarketplaceResourceMutable(params.resource);
	const { resource, filter } = params;
	const nowIso = clockNowIso();

	// Soft delete, matching the core resources.
	const result = await db
		.update(data)
		.set({ deleted_at: nowIso, updated_at: nowIso })
		.where(
			and(
				eq(data.id, filter.id),
				eq(data.resource, resource),
				isNull(data.deleted_at),
			),
		)
		.returning();

	if (result.length === 0) {
		throw new Error("Resource not found");
	}

	const row = result[0];
	const response = validateDeleteResponse(omitNulls(row));
	emitDataChanged(resource, "delete", row.data);
	return response;
}
