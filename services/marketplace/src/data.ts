import { eq, and, desc, gt, sql } from "drizzle-orm";
import pluralize from "pluralize";

import type {
	ApiRequest,
	DATA_PRIMITIVE,
	GetRequest,
	GetResponse,
	UpsertRequest,
} from "evy-types";
import {
	validateStrictGetRequest,
	validateStrictUpsertRequest,
} from "evy-types/rpcRequestHelpers";
import { data } from "./db/schema";
import { db } from "./db";
import { MARKETPLACE_DATA_RESOURCES } from "./catalog";
import {
	validateGetResponse,
	validateUpsertResponse,
} from "evy-types/validators";
import { validateDataPayload } from "./validation";

const MARKETPLACE_SERVICE = "marketplace";

export type MarketplaceSuggestion = {
	id: string;
	value: string;
};

async function getItemTagSuggestions(params: ApiRequest): Promise<GetResponse> {
	const query = params.filter?.query?.trim() ?? "";
	if (query.length === 0) {
		return validateGetResponse([]);
	}

	const normalizedQuery = query
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	const result = await db.execute(sql`
		WITH tags AS (
			SELECT DISTINCT ON ((tag->>'id'), lower(trim(tag->>'value')))
				tag->>'id' AS id,
				tag->>'value' AS value
			FROM ${data}, jsonb_array_elements(
				CASE
					WHEN jsonb_typeof(${data.data}->'tags') = 'array' THEN ${data.data}->'tags'
					ELSE '[]'::jsonb
				END
			) AS tag
			WHERE ${data.resource} = 'item'
				AND tag->>'id' IS NOT NULL
				AND length(trim(tag->>'value')) > 0
			ORDER BY (tag->>'id'), lower(trim(tag->>'value'))
		)
		SELECT id, value,
			CASE
				WHEN lower(trim(value)) = ${normalizedQuery} THEN 0.0
				WHEN lower(trim(value)) LIKE ${normalizedQuery || "%"} THEN 1.0 + (length(trim(value)) - ${normalizedQuery.length}) / 100.0
				WHEN position(${normalizedQuery} in lower(trim(value))) > 0 THEN 2.0 + (position(${normalizedQuery} in lower(trim(value))) - 1) / 100.0 + abs(length(trim(value)) - ${normalizedQuery.length}) / 1000.0
				ELSE 3.0 + levenshtein(${normalizedQuery}, lower(trim(value)))::float / GREATEST(${normalizedQuery.length}, length(trim(value)))
			END AS score
		FROM tags
		ORDER BY score, value
		LIMIT 3
	`);

	const rows =
		result && typeof result === "object" && "rows" in result
			? result.rows
			: result;

	const suggestions: MarketplaceSuggestion[] = [];
	for (const row of rows as Array<{ id: unknown; value: unknown }>) {
		if (typeof row.id === "string" && typeof row.value === "string") {
			suggestions.push({ id: row.id, value: row.value });
		}
	}

	return validateGetResponse([{ id: "query", value: query }, ...suggestions]);
}

function assertMarketplaceRules(
	params: GetRequest | ApiRequest | UpsertRequest,
): void {
	if (params.service !== MARKETPLACE_SERVICE) {
		throw new Error("Marketplace service requires service marketplace");
	}
	if (!MARKETPLACE_DATA_RESOURCES.has(params.resource)) {
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

async function marketplaceGetBody(
	params: GetRequest | ApiRequest,
): Promise<GetResponse> {
	const { resource, filter } = params;

	if ("method" in params && params.method) {
		if (resource === "items" && params.method === "suggestions") {
			return getItemTagSuggestions(params);
		}
		throw new Error(`Unsupported marketplace get method ${params.method}`);
	}

	const singularResource = pluralize.singular(resource);
	const whereClauses = [eq(data.resource, singularResource)];
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
	params: GetRequest | ApiRequest,
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
	const singularResource = pluralize.singular(resource);

	if (filter?.id) {
		const result = await db
			.update(data)
			.set({ data: validatedPayload, updatedAt: nowIso })
			.where(and(eq(data.id, filter.id), eq(data.resource, singularResource)))
			.returning();
		if (result.length > 0) {
			const row = result[0];
			validateUpsertResponse(row);
			return row;
		}
	}

	const insertValues: typeof data.$inferInsert = {
		resource: singularResource,
		data: validatedPayload,
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	if (filter?.id) {
		insertValues.id = filter.id;
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
