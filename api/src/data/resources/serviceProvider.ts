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
	validateDataEvyServiceProvider,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";

import { serviceProvider } from "../../../../types/generated/ts/db/schema.generated";
import {
	type EvyDb,
	hasDatabaseErrorCode,
	PG_UNIQUE_VIOLATION,
} from "../../database/db";

// Queries

export async function listProviderRows(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(serviceProvider);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(serviceProvider.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(serviceProvider.updatedAt, filter.updatedAfter));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(
		asc(serviceProvider.updatedAt),
		asc(serviceProvider.id),
	);
	return validateGetResponse(rows);
}

// Mutations

export async function createProviderResource(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = validateDataEvyServiceProvider(dataPayload);
	const inserted = await db
		.insert(serviceProvider)
		.values({
			id: filter?.id ?? validated.id,
			fkServiceId: validated.fkServiceId,
			fkOrganizationId: validated.fkOrganizationId,
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			createdAt: validated.createdAt,
			updatedAt: nowIso,
			retired: validated.retired,
		})
		.returning()
		.catch((err: unknown) => {
			if (hasDatabaseErrorCode(err, PG_UNIQUE_VIOLATION)) {
				throw new Error("Resource already exists");
			}
			throw err;
		});
	const response = validateCreateResponse(inserted[0]);

	notify(response);
	return response;
}

export async function updateProviderResource(
	db: EvyDb,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = validateDataEvyServiceProvider(dataPayload);
	const updated = await db
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
		.where(eq(serviceProvider.id, filter.id))
		.returning();
	if (updated.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateUpdateResponse(updated[0]);

	notify(response);
	return response;
}
