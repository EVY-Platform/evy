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
import { isValidResourceRef } from "evy-types/resourceRef";
import type { SyncRequest } from "evy-types/rpc/sync.request";
import {
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import type { EvyDb } from "../../database/db";
import { assertNotModified, monotonicUpdatedAt } from "../conflicts";

type ResourceTable = AnyPgTable & {
	id: AnyPgColumn;
	updated_at: AnyPgColumn;
	deleted_at: AnyPgColumn;
	visibility?: AnyPgColumn;
};

type AddressableResourceTable = ResourceTable & {
	fk: AnyPgColumn;
	resource: AnyPgColumn;
};

type OwnedResource = NonNullable<SyncRequest["owned_resources"]>[number];

export type SyncScope = {
	updated_after?: string;
	resource: string;
	owned: OwnedResource[];
};

export type SyncScopeInput = Omit<SyncScope, "resource">;

function isAddressableTable(
	table: ResourceTable,
): table is AddressableResourceTable {
	return "fk" in table && "resource" in table;
}

export function ownedIdsOf(scope: SyncScope): string[] {
	const ids: string[] = [];
	for (const group of scope.owned) {
		if (group.resource === scope.resource) {
			ids.push(...group.ids);
		}
	}
	return ids;
}

function syncEntitlementClause(
	table: ResourceTable,
	ownedIds: string[],
): SQL | undefined {
	if (!table.visibility) return undefined;
	const publicRows = eq(table.visibility, "public");
	if (ownedIds.length === 0) return publicRows;
	return or(publicRows, inArray(table.id, ownedIds));
}

function syncTimeClause(
	table: ResourceTable,
	updated_after: string | undefined,
): SQL | undefined {
	return updated_after
		? gt(table.updated_at, updated_after)
		: isNull(table.deleted_at);
}

function addressedRecordClause(
	table: AddressableResourceTable,
	owned: OwnedResource[],
): SQL | undefined {
	const clauses: SQL[] = [];

	for (const group of owned) {
		if (group.ids.length === 0) continue;
		if (!isValidResourceRef(group.resource)) continue; // reserved-slug refs from sync scope
		clauses.push(
			and(
				eq(table.resource, group.resource),
				inArray(table.fk, group.ids),
			) as SQL,
		);
	}

	if (clauses.length === 0) return undefined;
	return or(...clauses);
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
	const ownedIds = ownedIdsOf(scope);
	const entitlement = [
		syncEntitlementClause(table, ownedIds),
		isAddressableTable(table)
			? addressedRecordClause(table, scope.owned)
			: undefined,
		...extraEntitlements,
	].filter((clause): clause is SQL => clause !== undefined);

	const clauses = [
		syncTimeClause(table, scope.updated_after),
		or(...entitlement),
	].filter((clause): clause is SQL => clause !== undefined);

	const rows = await db
		.select()
		.from(table)
		.where(clauses.length > 0 ? and(...clauses) : undefined)
		.orderBy(asc(table.updated_at), asc(table.id));

	return validateGetResponse(rows.map(norm));
}

export function makeCoreResource<
	T extends {
		id: string;
		created_at: string;
		updated_at: string;
	},
>(config: {
	table: ResourceTable;
	validate: (raw: unknown) => T;
	toUpdateSet: (validated: T, nowIso: string) => Record<string, unknown>;
	normalize?: (raw: unknown) => T;
	extraSyncEntitlements?: (scope: SyncScope) => (SQL | undefined)[];
}) {
	const { table, validate, toUpdateSet, normalize, extraSyncEntitlements } =
		config;
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
			created_at: createdAtOverride ?? record.created_at ?? nowIso,
			updated_at: nowIso,
		};
		// visibility comes from the client, never the API
		return validate(payload);
	}

	async function list(
		db: EvyDb,
		filter: GetRequest["filter"] | undefined,
	): Promise<GetResponse> {
		const base = db.select().from(table);
		const whereClauses: ReturnType<typeof eq>[] = [];
		if (filter?.id) whereClauses.push(eq(table.id, filter.id));
		if (filter?.updated_after) {
			whereClauses.push(gt(table.updated_at, filter.updated_after));
		} else {
			whereClauses.push(isNull(table.deleted_at));
		}
		const query = whereClauses.length
			? base.where(and(...whereClauses))
			: base;
		const rows = await query.orderBy(asc(table.updated_at), asc(table.id));
		return validateGetResponse(rows.map(norm));
	}

	async function listForSync(
		db: EvyDb,
		scope: SyncScope,
	): Promise<GetResponse> {
		const extra =
			extraSyncEntitlements?.(scope).filter(
				(clause): clause is SQL => clause !== undefined,
			) ?? [];
		return runListForSync(db, table, scope, norm, extra);
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
		assertNotModified(
			filter.expected_updated_at,
			existingRows[0].updated_at,
		);
		const nextUpdatedAt = monotonicUpdatedAt(
			nowIso,
			existingRows[0].updated_at,
		);
		const validated = validatePayload(
			dataPayload,
			nowIso,
			filter.id,
			existingRows[0].created_at,
		);
		const updated = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.update(table as any)
			.set({
				...toUpdateSet(validated, nowIso),
				updated_at: nextUpdatedAt,
			})
			.where(eq(table.id, filter.id))
			.returning();
		const response = validateUpdateResponse(norm(updated[0]));
		notify(response);
		return response;
	}

	async function remove(
		db: EvyDb,
		filter: DeleteRequest["filter"],
		notify: (value: unknown) => void,
		nowIso: string = new Date().toISOString(),
	): Promise<DeleteResponse> {
		const existing = await db
			.select()
			.from(table)
			.where(and(eq(table.id, filter.id), isNull(table.deleted_at)))
			.limit(1);
		if (existing.length === 0) throw new Error("Resource not found");
		assertNotModified(filter.expected_updated_at, existing[0].updated_at);
		const deletedAtIso = monotonicUpdatedAt(nowIso, existing[0].updated_at);
		const deleted = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.update(table as any)
			.set({ deleted_at: deletedAtIso, updated_at: deletedAtIso })
			.where(and(eq(table.id, filter.id), isNull(table.deleted_at)))
			.returning();
		if (deleted.length === 0) throw new Error("Resource not found");
		const response = validateDeleteResponse(norm(deleted[0]));
		notify(response);
		return response;
	}

	return { list, listForSync, create, update, remove };
}
