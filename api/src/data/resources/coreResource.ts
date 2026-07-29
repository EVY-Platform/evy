import { and, asc, eq, gt, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
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
import { hasDatabaseErrorCode, PG_UNIQUE_VIOLATION } from "evy-types/dbErrors";
import type { SyncRequest } from "evy-types/rpc/sync.request";
import {
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import type { EvyDb } from "../../database/db";
import { assertNotModified, monotonicUpdatedAt } from "../conflicts";

export type ResourceTable = AnyPgTable & {
	id: AnyPgColumn;
	updatedAt: AnyPgColumn;
	deletedAt: AnyPgColumn;
	/** Absent on resources with no visibility of their own, e.g. formatters. */
	visibility?: AnyPgColumn;
};

/** Ids a device owns within one service resource, as declared on the sync request. */
export type OwnedServiceResource = NonNullable<
	SyncRequest["ownedServiceResources"]
>[number];

export type SyncScope = {
	updatedAfter?: string;
	/** Ids of this resource's records the calling device declared as owned. */
	ownedIds: string[];
	/** Records the device owns elsewhere. Only messages read these, as fk targets. */
	ownedForeignKeys: OwnedServiceResource[];
};

/**
 * What a device may see of a resource: every public row, plus the private rows it
 * owns. A resource with no visibility column has nothing to scope, so it returns
 * undefined and the caller filters on time alone.
 *
 * Note there is no signal for losing access. A row flipped from public to private
 * simply stops matching, so a device that already holds it keeps a stale copy -
 * nothing changes visibility after creation today, but that is the gap to close if
 * it ever does.
 */
export function syncEntitlementClause(
	table: ResourceTable,
	ownedIds: string[],
): SQL | undefined {
	if (!table.visibility) return undefined;
	const publicRows = eq(table.visibility, "public");
	if (ownedIds.length === 0) return publicRows;
	return or(publicRows, inArray(table.id, ownedIds));
}

/** The time half of a sync read: incremental carries tombstones, plain excludes them. */
export function syncTimeClause(
	table: ResourceTable,
	updatedAfter: string | undefined,
): SQL | undefined {
	return updatedAfter
		? gt(table.updatedAt, updatedAfter)
		: isNull(table.deletedAt);
}

export function omitNulls<T extends Record<string, unknown>>(row: T): T {
	return Object.fromEntries(
		Object.entries(row).filter(([, value]) => value !== null),
	) as T;
}

export async function runListForSync<T>(
	db: EvyDb,
	table: ResourceTable,
	scope: SyncScope,
	norm: (raw: unknown) => T,
	extraEntitlements: SQL[] = [],
): Promise<GetResponse> {
	const entitlement = [
		syncEntitlementClause(table, scope.ownedIds),
		...extraEntitlements,
	].filter((clause): clause is SQL => clause !== undefined);

	const clauses = [
		syncTimeClause(table, scope.updatedAfter),
		entitlement.length > 1 ? or(...entitlement) : entitlement[0],
	].filter((clause): clause is SQL => clause !== undefined);

	const rows = await db
		.select()
		.from(table)
		.where(clauses.length > 0 ? and(...clauses) : undefined)
		.orderBy(asc(table.updatedAt), asc(table.id));

	return validateGetResponse(rows.map(norm));
}

export function makeCoreResource<
	T extends {
		id: string;
		createdAt: string;
		updatedAt: string;
	},
>(config: {
	table: ResourceTable;
	validate: (raw: unknown) => T;
	toUpdateSet: (validated: T, nowIso: string) => Record<string, unknown>;
	normalize?: (raw: unknown) => T;
}) {
	const { table, validate, toUpdateSet, normalize } = config;
	// Nullable columns come back from Drizzle as null, which the schemas do not
	// allow for optional fields, so stripping nulls is the default rather than
	// something each resource has to remember when a nullable column is added.
	const norm =
		normalize ??
		((raw: unknown) => validate(omitNulls(raw as Record<string, unknown>)));

	function validatePayload(
		dataPayload: unknown,
		nowIso: string,
		idOverride?: string,
		createdAtOverride?: string,
	): T {
		const record =
			dataPayload !== null && typeof dataPayload === "object"
				? (dataPayload as Record<string, unknown>)
				: {};
		const payload: Record<string, unknown> = {
			...record,
			id: idOverride ?? record.id ?? crypto.randomUUID(),
			createdAt: createdAtOverride ?? record.createdAt ?? nowIso,
			updatedAt: nowIso,
		};
		// `visibility` is deliberately not supplied here. Every resource that has one
		// declares it in core.resources.json, and the creating client sends it; the
		// API only checks that it arrived. Filling one in would let a caller create a
		// record whose visibility nobody chose.
		return validate(payload);
	}

	async function list(
		db: EvyDb,
		filter: GetRequest["filter"] | undefined,
	): Promise<GetResponse> {
		const base = db.select().from(table);
		const whereClauses: ReturnType<typeof eq>[] = [];
		if (filter?.id) whereClauses.push(eq(table.id, filter.id));
		if (filter?.updatedAfter) {
			// An incremental read must carry tombstones, otherwise a client can
			// never learn that a record it holds was deleted.
			whereClauses.push(gt(table.updatedAt, filter.updatedAfter));
		} else {
			whereClauses.push(isNull(table.deletedAt));
		}
		const query = whereClauses.length
			? base.where(and(...whereClauses))
			: base;
		const rows = await query.orderBy(asc(table.updatedAt), asc(table.id));
		return validateGetResponse(rows.map(norm));
	}

	/**
	 * The rows this device is entitled to. An owner must keep receiving the
	 * tombstone for a private row it owns, or it could never learn the row was
	 * deleted - `visibility` and `id` both survive a soft delete, so it does.
	 */
	async function listForSync(
		db: EvyDb,
		scope: SyncScope,
	): Promise<GetResponse> {
		return runListForSync(db, table, scope, norm);
	}

	async function create(
		db: EvyDb,
		filter: CreateRequest["filter"] | undefined,
		dataPayload: unknown,
		nowIso: string,
		notify: (value: unknown) => void,
	): Promise<CreateResponse> {
		const validated = validatePayload(dataPayload, nowIso, filter?.id);
		const inserted = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.insert(table as any)
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.values(validated as any)
			.returning()
			.catch((err: unknown) => {
				if (hasDatabaseErrorCode(err, PG_UNIQUE_VIOLATION))
					throw new Error("Resource already exists");
				throw err;
			});
		const response = validateCreateResponse(norm(inserted[0]));
		notify(response);
		return response;
	}

	async function update(
		db: EvyDb,
		filter: UpdateRequest["filter"],
		dataPayload: unknown,
		nowIso: string,
		notify: (value: unknown) => void,
	): Promise<UpdateResponse> {
		const existingRows = await db
			.select()
			.from(table)
			.where(eq(table.id, filter.id))
			.limit(1);
		if (existingRows.length === 0) throw new Error("Resource not found");
		assertNotModified(filter.expectedUpdatedAt, existingRows[0].updatedAt);
		const nextUpdatedAt = monotonicUpdatedAt(
			nowIso,
			existingRows[0].updatedAt,
		);
		const validated = validatePayload(
			dataPayload,
			nowIso,
			filter.id,
			existingRows[0].createdAt,
		);
		const updated = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.update(table as any)
			.set({
				...toUpdateSet(validated, nowIso),
				updatedAt: nextUpdatedAt,
			})
			.where(eq(table.id, filter.id))
			.returning();
		const response = validateUpdateResponse(norm(updated[0]));
		notify(response);
		return response;
	}

	/**
	 * Soft delete. The row is kept as a tombstone so incremental syncs can tell
	 * clients it is gone; plain reads exclude it. Tombstones are kept
	 * permanently, so a client can resume from any cursor and still learn about
	 * every delete.
	 */
	async function remove(
		db: EvyDb,
		filter: DeleteRequest["filter"],
		notify: (value: unknown) => void,
		nowIso: string = new Date().toISOString(),
	): Promise<DeleteResponse> {
		const existing = await db
			.select()
			.from(table)
			.where(and(eq(table.id, filter.id), isNull(table.deletedAt)))
			.limit(1);
		if (existing.length === 0) throw new Error("Resource not found");
		assertNotModified(filter.expectedUpdatedAt, existing[0].updatedAt);
		const deletedAtIso = monotonicUpdatedAt(nowIso, existing[0].updatedAt);
		const deleted = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.update(table as any)
			.set({ deletedAt: deletedAtIso, updatedAt: deletedAtIso })
			.where(and(eq(table.id, filter.id), isNull(table.deletedAt)))
			.returning();
		if (deleted.length === 0) throw new Error("Resource not found");
		const response = validateDeleteResponse(norm(deleted[0]));
		notify(response);
		return response;
	}

	return { list, listForSync, create, update, remove };
}
