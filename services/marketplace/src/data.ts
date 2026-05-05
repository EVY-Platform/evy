import { eq, and, desc, gt } from "drizzle-orm";

import type {
	DATA_PRIMITIVE,
	GetRequest,
	GetResponse,
	UpsertRequest,
} from "evy-types";
import {
	getServiceResources,
	setServiceRegistry,
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import { data } from "./db/schema";
import { db } from "./db";
import { MARKETPLACE_RESOURCE_NAMES, MARKETPLACE_SERVICE } from "./catalog";
import {
	assertIsoDateTimeJsonFields,
	validateGetResponse,
	validateUpsertDataPayload,
	validateUpsertResponse,
} from "evy-types/validators";

setServiceRegistry([[MARKETPLACE_SERVICE, [...MARKETPLACE_RESOURCE_NAMES]]]);

function validateDataPayload(dataPayload: unknown): DATA_PRIMITIVE["data"] {
	const validatedPayload = validateUpsertDataPayload(dataPayload);
	assertIsoDateTimeJsonFields(validatedPayload);
	return validatedPayload;
}

function assertMarketplaceRules(params: GetRequest | UpsertRequest): void {
	if (params.service !== MARKETPLACE_SERVICE) {
		throw new Error("Marketplace service requires service marketplace");
	}
	const marketplaceResources = getServiceResources(MARKETPLACE_SERVICE) ?? [];
	if (!marketplaceResources.includes(params.resource)) {
		throw new Error("Unsupported resource for marketplace service");
	}
}

function validateMarketplaceGetParams(
	params: unknown,
): asserts params is GetRequest {
	validateStrictGetRequest(params);
	assertMarketplaceRules(params);
}

function validateMarketplaceUpsertParams(
	params: unknown,
): asserts params is UpsertRequest {
	validateStrictUpsertRequest(params);
	assertMarketplaceRules(params);
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
		.orderBy(desc(data.updatedAt));

	return validateGetResponse(rows.map((r) => r.data));
}

/**
 * Marketplace `get` after JSON-RPC shape checks. Callers must already have run
 * {@link validateStrictGetRequest}; this only applies marketplace access rules.
 */
export async function getForValidatedMarketplaceRequest(
	params: GetRequest,
): Promise<GetResponse> {
	assertMarketplaceRules(params);
	return marketplaceGetBody(params);
}

export async function get(params: unknown): Promise<GetResponse> {
	validateMarketplaceGetParams(params);
	return marketplaceGetBody(params);
}

async function marketplaceUpsertBody(
	params: UpsertRequest,
): Promise<DATA_PRIMITIVE> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	const validatedPayload = validateDataPayload(dataPayload);

	const filterId = filter?.id;
	if (filterId) {
		const result = await db
			.update(data)
			.set({ data: validatedPayload, updatedAt: nowIso })
			.where(and(eq(data.id, filterId), eq(data.resource, resource)))
			.returning();
		if (result.length > 0) {
			const row = result[0];
			validateUpsertResponse(row);
			return row;
		}
	}

	const insertValues: typeof data.$inferInsert = {
		resource,
		data: validatedPayload,
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	if (filterId) {
		insertValues.id = filterId;
	}

	const result = await db.insert(data).values(insertValues).returning();
	const row = result[0];
	validateUpsertResponse(row);
	return row;
}

/**
 * Marketplace `upsert` after JSON-RPC shape checks. Callers must already have run
 * {@link validateStrictUpsertRequest}; this only applies marketplace access rules.
 */
export async function upsertForValidatedMarketplaceRequest(
	params: UpsertRequest,
): Promise<DATA_PRIMITIVE> {
	assertMarketplaceRules(params);
	return marketplaceUpsertBody(params);
}

export async function upsert(params: unknown): Promise<DATA_PRIMITIVE> {
	validateMarketplaceUpsertParams(params);
	return marketplaceUpsertBody(params);
}
