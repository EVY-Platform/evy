import { and, asc, eq, gt } from "drizzle-orm";

import type {
	CreateRequest,
	CreateResponse,
	DATA_EVY_Service,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	validateCreateResponse,
	validateDataEvyService,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";

import { service } from "../../../../types/generated/ts/db/schema.generated";
import { hasDatabaseErrorCode, type EvyDb } from "../../database/db";

// Queries

export async function listServiceRows(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(service);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(service.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(service.updatedAt, filter.updatedAfter));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(asc(service.updatedAt), asc(service.id));
	return validateGetResponse(rows.map(mapServiceRow));
}

// Mutations

export async function createServiceResource(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = validateDataEvyService(dataPayload);
	const inserted = await db
		.insert(service)
		.values({
			id: filter?.id ?? validated.id,
			name: validated.name,
			description: validated.description,
			sortOrder: validated.sortOrder ?? null,
			createdAt: validated.createdAt,
			updatedAt: nowIso,
		})
		.returning()
		.catch((err: unknown) => {
			if (hasDatabaseErrorCode(err, "23505")) {
				throw new Error("Resource already exists");
			}
			throw err;
		});
	const response = validateCreateResponse(mapServiceRow(inserted[0]));

	notify(response);
	return response;
}

export async function updateServiceResource(
	db: EvyDb,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = validateDataEvyService(dataPayload);
	const updated = await db
		.update(service)
		.set({
			name: validated.name,
			description: validated.description,
			sortOrder: validated.sortOrder ?? null,
			updatedAt: nowIso,
		})
		.where(eq(service.id, filter.id))
		.returning();
	if (updated.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateUpdateResponse(mapServiceRow(updated[0]));

	notify(response);
	return response;
}

// Row mapping

function mapServiceRow(r: typeof service.$inferSelect): DATA_EVY_Service {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		...(r.sortOrder !== null ? { sortOrder: r.sortOrder } : {}),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}
