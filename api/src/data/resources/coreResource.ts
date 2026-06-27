import { and, asc, eq, gt } from "drizzle-orm";
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
import {
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import {
	type EvyDb,
	hasDatabaseErrorCode,
	PG_UNIQUE_VIOLATION,
} from "../../database/db";

type ResourceTable = AnyPgTable & { id: AnyPgColumn; updatedAt: AnyPgColumn };

export function makeCoreResource<
	T extends { id: string; createdAt: string; updatedAt: string },
>(config: {
	table: ResourceTable;
	validate: (raw: unknown) => T;
	toUpdateSet: (validated: T, nowIso: string) => Record<string, unknown>;
	normalize?: (raw: unknown) => T;
}) {
	const { table, validate, toUpdateSet, normalize } = config;
	const norm = normalize ?? validate;

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
		return validate({
			...record,
			id: idOverride ?? record.id,
			createdAt: createdAtOverride ?? record.createdAt ?? nowIso,
			updatedAt: nowIso,
		});
	}

	async function list(
		db: EvyDb,
		filter: GetRequest["filter"] | undefined,
	): Promise<GetResponse> {
		const base = db.select().from(table);
		const whereClauses: ReturnType<typeof eq>[] = [];
		if (filter?.id) whereClauses.push(eq(table.id, filter.id));
		if (filter?.updatedAfter)
			whereClauses.push(gt(table.updatedAt, filter.updatedAfter));
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
		const validated = validatePayload(
			dataPayload,
			nowIso,
			filter.id,
			existingRows[0].createdAt,
		);
		const updated = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.update(table as any)
			.set({ ...toUpdateSet(validated, nowIso), updatedAt: nowIso })
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
	): Promise<DeleteResponse> {
		const deleted = await db
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic table requires cast
			.delete(table as any)
			.where(eq(table.id, filter.id))
			.returning();
		if (deleted.length === 0) throw new Error("Resource not found");
		const response = validateDeleteResponse(norm(deleted[0]));
		notify(response);
		return response;
	}

	return { list, create, update, remove };
}
