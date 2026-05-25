import { eq, and, desc, gt } from "drizzle-orm";

import type {
	CreateRequest,
	CreateResponse,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	getServiceResources,
	setServiceRegistry,
} from "evy-types/rpcRequestHelpers";
import { data } from "./db/schema";
import { db } from "./db";
import { MARKETPLACE_RESOURCE_NAMES, MARKETPLACE_SERVICE } from "./catalog";
import { emitDataChanged } from "./events";
import {
	assertIsoDateTimeJsonFields,
	validateGetResponse,
	validateCreateDataPayload,
	validateUpdateDataPayload,
	validateCreateResponse,
	validateUpdateResponse,
} from "evy-types/validators";
import {
	buildCollectionResponseEnvelope,
	buildSingleResponseEnvelope,
} from "evy-types/rpcResponseHelpers";

setServiceRegistry([[MARKETPLACE_SERVICE, [...MARKETPLACE_RESOURCE_NAMES]]]);

function buildGetResponse(items: unknown[]): GetResponse {
	return validateGetResponse(buildCollectionResponseEnvelope(items));
}

function buildCreateResponse(item: CreateResponse["data"]): CreateResponse {
	return validateCreateResponse(buildSingleResponseEnvelope(item));
}

function buildUpdateResponse(item: UpdateResponse["data"]): UpdateResponse {
	return validateUpdateResponse(buildSingleResponseEnvelope(item));
}

function assertMarketplaceRules(
	params: GetRequest | CreateRequest | UpdateRequest,
): void {
	if (params.service !== MARKETPLACE_SERVICE) {
		throw new Error("Marketplace service requires service marketplace");
	}
	const marketplaceResources = getServiceResources(MARKETPLACE_SERVICE) ?? [];
	if (!marketplaceResources.includes(params.resource)) {
		throw new Error("Unsupported resource for marketplace service");
	}
}

async function marketplaceGetBody(params: GetRequest): Promise<GetResponse> {
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
		.orderBy(desc(data.updatedAt), desc(data.id));

	return buildGetResponse(rows.map((r) => r.data));
}

/**
 * Marketplace `get` after JSON-RPC shape checks. This only applies marketplace access rules.
 */
export async function get(params: GetRequest): Promise<GetResponse> {
	assertMarketplaceRules(params);
	return marketplaceGetBody(params);
}

async function marketplaceCreateBody(
	params: CreateRequest,
): Promise<CreateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	const validatedPayload = validateCreateDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);

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
	} catch {
		throw new Error("Resource already exists");
	}

	const row = result[0];
	const response = buildCreateResponse(row);
	emitDataChanged(resource, "create", row.data);
	return response;
}

async function marketplaceUpdateBody(
	params: UpdateRequest,
): Promise<UpdateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	const validatedPayload = validateUpdateDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);

	const result = await db
		.update(data)
		.set({ data: validatedPayload, updatedAt: nowIso })
		.where(and(eq(data.id, filter.id), eq(data.resource, resource)))
		.returning();

	if (result.length === 0) {
		throw new Error("Resource not found");
	}

	const row = result[0];
	const response = buildUpdateResponse(row);
	emitDataChanged(resource, "update", row.data);
	return response;
}

/**
 * Marketplace `create` after marketplace access rules.
 */
export async function create(params: CreateRequest): Promise<CreateResponse> {
	assertMarketplaceRules(params);
	return marketplaceCreateBody(params);
}

/**
 * Marketplace `update` after marketplace access rules.
 */
export async function update(params: UpdateRequest): Promise<UpdateResponse> {
	assertMarketplaceRules(params);
	return marketplaceUpdateBody(params);
}
