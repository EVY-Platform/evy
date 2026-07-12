import { and, asc, eq, gt } from "drizzle-orm";

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
	assertIsoDateTimeJsonFields,
	validateCreateDataPayload,
	validateCreateResponse,
	validateDeleteResponse,
	validateGetResponse,
	validateMarketplaceRequest,
	validateUpdateDataPayload,
	validateUpdateResponse,
} from "evy-types/validators";
import { data, db } from "./db";
import { emitDataChanged } from "./events";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SEED_RESOURCES,
	MARKETPLACE_SERVICE,
} from "./resources";

const PG_UNIQUE_VIOLATION = "23505" as const;

function validateResourcePayload(resource: string, payload: unknown): void {
	if (resource === MARKETPLACE_RESOURCE.REQUESTS) {
		validateMarketplaceRequest(payload);
	}
}

function assertMarketplaceRules(
	params: GetRequest | CreateRequest | UpdateRequest | DeleteRequest,
): void {
	if (params.service !== MARKETPLACE_SERVICE) {
		throw new Error(
			"Marketplace service requires the marketplace service id",
		);
	}
	if (!MARKETPLACE_SEED_RESOURCES.has(params.resource)) {
		throw new Error("Unsupported resource id for marketplace service");
	}
}

export async function get(params: GetRequest): Promise<GetResponse> {
	assertMarketplaceRules(params);
	const { resource, filter } = params;

	const whereClauses = [eq(data.resource, resource)];
	if (filter?.id) {
		whereClauses.push(eq(data.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(data.updatedAt, filter.updatedAfter));
	}

	const rows = await db
		.select({ data: data.data })
		.from(data)
		.where(and(...whereClauses))
		.orderBy(asc(data.updatedAt), asc(data.id));

	return validateGetResponse(rows.map((r) => r.data));
}

export async function create(params: CreateRequest): Promise<CreateResponse> {
	assertMarketplaceRules(params);
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	const validatedPayload = validateCreateDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);
	validateResourcePayload(resource, validatedPayload);

	const filterId = filter?.id;
	const insertValues: typeof data.$inferInsert = {
		resource,
		data: validatedPayload,
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	if (filterId) {
		insertValues.id = filterId;
	}

	let result: (typeof data.$inferSelect)[];
	try {
		result = await db.insert(data).values(insertValues).returning();
	} catch (err: unknown) {
		const code =
			typeof err === "object" &&
			err !== null &&
			"code" in err &&
			typeof err.code === "string"
				? err.code
				: undefined;
		if (code === PG_UNIQUE_VIOLATION) {
			throw new Error("Resource already exists");
		}
		throw err;
	}

	const row = result[0];
	const response = validateCreateResponse(row);
	emitDataChanged(resource, "create", row.data);
	return response;
}

export async function update(params: UpdateRequest): Promise<UpdateResponse> {
	assertMarketplaceRules(params);
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	const validatedPayload = validateUpdateDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);
	validateResourcePayload(resource, validatedPayload);

	const result = await db
		.update(data)
		.set({ data: validatedPayload, updatedAt: nowIso })
		.where(and(eq(data.id, filter.id), eq(data.resource, resource)))
		.returning();

	if (result.length === 0) {
		throw new Error("Resource not found");
	}

	const row = result[0];
	const response = validateUpdateResponse(row);
	emitDataChanged(resource, "update", row.data);
	return response;
}

export async function deleteResource(
	params: DeleteRequest,
): Promise<DeleteResponse> {
	assertMarketplaceRules(params);
	const { resource, filter } = params;

	const result = await db
		.delete(data)
		.where(and(eq(data.id, filter.id), eq(data.resource, resource)))
		.returning();

	if (result.length === 0) {
		throw new Error("Resource not found");
	}

	const row = result[0];
	const response = validateDeleteResponse(row);
	emitDataChanged(resource, "delete", row.data);
	return response;
}
