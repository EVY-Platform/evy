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
	validateDataEvyOrganization,
	validateGetResponse,
	validateUpdateResponse,
} from "evy-types/validators";

import { organization } from "../../../../types/generated/ts/db/schema.generated";
import { type EvyDb, hasDatabaseErrorCode } from "../../database/db";

// Queries

export async function listOrganizationRows(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(organization);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(organization.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(organization.updatedAt, filter.updatedAfter));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(
		asc(organization.updatedAt),
		asc(organization.id),
	);
	return validateGetResponse(rows);
}

// Mutations

export async function createOrganizationResource(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = validateDataEvyOrganization(dataPayload);
	const inserted = await db
		.insert(organization)
		.values({
			id: filter?.id ?? validated.id,
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			supportEmail: validated.supportEmail,
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

export async function updateOrganizationResource(
	db: EvyDb,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = validateDataEvyOrganization(dataPayload);
	const updated = await db
		.update(organization)
		.set({
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			supportEmail: validated.supportEmail,
			updatedAt: nowIso,
		})
		.where(eq(organization.id, filter.id))
		.returning();
	if (updated.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateUpdateResponse(updated[0]);

	notify(response);
	return response;
}
