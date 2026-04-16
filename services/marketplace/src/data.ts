import { eq, and, desc } from "drizzle-orm";
import pluralize from "pluralize";

import {
	type DATA_EVY_Data,
	type DATA_EVY_Rows,
	type GetResponse,
	NAMESPACE_VALUES,
	RESOURCE_VALUES,
	type GetRequest,
	type UpsertRequest,
} from "evy-types";
import { MARKETPLACE_DATA_RESOURCES } from "./constants";
import { data } from "./db/schema";
import { db } from "./db";
import { validateDataPayload } from "./validation";

const MARKETPLACE_NAMESPACE = "marketplace";

type Namespace = GetRequest["namespace"];
type Resource = GetRequest["resource"];

function isNamespace(v: unknown): v is Namespace {
	return typeof v === "string" && NAMESPACE_VALUES.includes(v as Namespace);
}

function isResource(v: unknown): v is Resource {
	return typeof v === "string" && RESOURCE_VALUES.includes(v as Resource);
}

type IsoTimestampColumns = {
	createdAt: string;
	updatedAt: string;
};

function formatPersistedDataRow(
	row: IsoTimestampColumns & {
		id: string;
		namespace: string;
		resource: string;
		data: DATA_EVY_Data["data"];
	},
): DATA_EVY_Data {
	return {
		id: row.id,
		namespace: row.namespace,
		resource: row.resource,
		data: row.data,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function assertMarketplaceResource(resource: Resource): void {
	if (resource === "sdui") {
		throw new Error("SDUI is served by the api, not the marketplace service");
	}
	if (MARKETPLACE_DATA_RESOURCES.has(resource)) {
		return;
	}
	throw new Error("Unsupported resource for marketplace service");
}

function validateParams(
	params: unknown,
): asserts params is GetRequest | UpsertRequest {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
	if (!("namespace" in params) || !isNamespace(params.namespace)) {
		throw new Error("Invalid or missing namespace");
	}
	if (params.namespace !== MARKETPLACE_NAMESPACE) {
		throw new Error("Marketplace service requires namespace marketplace");
	}
	if (!("resource" in params) || !isResource(params.resource)) {
		throw new Error("Invalid or missing resource");
	}
	assertMarketplaceResource(params.resource);
	if (
		"filter" in params &&
		params.filter !== undefined &&
		(typeof params.filter !== "object" || params.filter === null)
	) {
		throw new Error("filter must be an object");
	}
}

export async function get(params: unknown): Promise<GetResponse> {
	validateParams(params);
	const { resource, filter } = params;

	const singularResource = pluralize.singular(resource);
	const whereClauses = [
		eq(data.namespace, MARKETPLACE_NAMESPACE),
		eq(data.resource, singularResource),
	];
	if (filter?.id) {
		whereClauses.push(eq(data.id, filter.id));
	}

	const rows = await db
		.select({ data: data.data })
		.from(data)
		.where(and(...whereClauses))
		.orderBy(desc(data.updatedAt));

	return rows.map((r) => r.data) as GetResponse;
}

export async function upsert(params: unknown): Promise<DATA_EVY_Rows> {
	validateParams(params);
	if (
		!("data" in params) ||
		params.data === undefined ||
		typeof params.data !== "object" ||
		params.data === null
	) {
		throw new Error("data is required and must be a non-null object");
	}

	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	const validatedPayload = validateDataPayload(dataPayload);
	const singularResource = pluralize.singular(resource);

	if (filter?.id) {
		const result = await db
			.update(data)
			.set({ data: validatedPayload, updatedAt: nowIso })
			.where(
				and(
					eq(data.id, filter.id),
					eq(data.namespace, MARKETPLACE_NAMESPACE),
					eq(data.resource, singularResource),
				),
			)
			.returning();
		if (result.length > 0) {
			return formatPersistedDataRow(result[0]);
		}
	}

	const result = await db
		.insert(data)
		.values({
			namespace: MARKETPLACE_NAMESPACE,
			resource: singularResource,
			data: validatedPayload,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
		.returning();
	return formatPersistedDataRow(result[0]);
}
