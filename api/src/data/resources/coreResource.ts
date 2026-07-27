import { and, asc, eq, gt, isNull } from "drizzle-orm";
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
	updatedAt: AnyPgColumn;
	deletedAt: AnyPgColumn;
};

export function omitNulls<T extends Record<string, unknown>>(row: T): T {
	return Object.fromEntries(
		Object.entries(row).filter(([, value]) => value !== null),
	) as T;
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
	/** Default for the payload's `visibility`; `false` for tables without the column. */
	visibility?: "public" | "private" | false;
}) {
	const {
		table,
		validate,
		toUpdateSet,
		normalize,
		visibility = "public",
	} = config;
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
		if (visibility !== false) {
			payload.visibility = record.visibility ?? visibility;
		}
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

	return { list, create, update, remove };
}
