import { and, asc, eq, gt } from "drizzle-orm";

import type {
	CreateRequest,
	CreateResponse,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	validateCreateResponse,
	validateDataEvyServiceResource,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";

import { serviceResource } from "../../../../types/generated/ts/db/schema.generated";
import { hasDatabaseErrorCode, type EvyDb } from "../../database/db";

export async function listServiceResourceRows(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(serviceResource);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(serviceResource.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(serviceResource.updatedAt, filter.updatedAfter));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(
		asc(serviceResource.updatedAt),
		asc(serviceResource.id),
	);
	return validateGetResponse(rows);
}

export async function createServiceResourceRow(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = validateDataEvyServiceResource(dataPayload);
	const inserted = await db
		.insert(serviceResource)
		.values({
			id: filter?.id ?? validated.id,
			fkServiceId: validated.fkServiceId,
			name: validated.name,
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
	const response = validateCreateResponse(inserted[0]);

	notify(response);
	return response;
}

export async function updateServiceResourceRow(
	db: EvyDb,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = validateDataEvyServiceResource(dataPayload);
	const updated = await db
		.update(serviceResource)
		.set({
			fkServiceId: validated.fkServiceId,
			name: validated.name,
			updatedAt: nowIso,
		})
		.where(eq(serviceResource.id, filter.id))
		.returning();
	if (updated.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateUpdateResponse(updated[0]);

	notify(response);
	return response;
}
