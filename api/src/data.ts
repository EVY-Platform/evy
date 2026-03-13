import { eq, and, desc } from "drizzle-orm";
import pluralize from "pluralize";

import {
	type DATA_Data,
	type DATA_Flow,
	type DATA_Rows,
	type GetResponse,
	NAMESPACE_VALUES,
	RESOURCE_VALUES,
	type GetRequest,
	type OS,
	type SDUI_Flow,
	type UpsertRequest,
} from "evy-types";
import {
	device,
	flow,
	data,
	osEnum,
} from "../../types/generated/ts/db/schema.generated";
import { db } from "./db";
import { validateFlowData } from "./validation";

type Namespace = GetRequest["namespace"];
type Resource = GetRequest["resource"];

function isNamespace(v: unknown): v is Namespace {
	return typeof v === "string" && NAMESPACE_VALUES.includes(v as Namespace);
}
export function isResource(v: unknown): v is Resource {
	return typeof v === "string" && RESOURCE_VALUES.includes(v as Resource);
}
export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

type PersistedFlowRow = {
	id: string;
	data: SDUI_Flow;
	createdAt: Date;
	updatedAt: Date;
};

type PersistedDataRow = {
	id: string;
	namespace: string;
	resource: string;
	data: DATA_Data["data"];
	createdAt: Date;
	updatedAt: Date;
};

function formatFlowRow(row: PersistedFlowRow): DATA_Flow {
	return {
		id: row.id,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function formatPersistedDataRow(row: PersistedDataRow): DATA_Data {
	return {
		id: row.id,
		namespace: row.namespace,
		resource: row.resource,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
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
	if (!("resource" in params) || !isResource(params.resource)) {
		throw new Error("Invalid or missing resource");
	}
	if (
		"filter" in params &&
		params.filter !== undefined &&
		(typeof params.filter !== "object" || params.filter === null)
	) {
		throw new Error("filter must be an object");
	}
}

export async function validateAuth(token: string, os: OS): Promise<boolean> {
	if (!token || token.length < 1) throw new Error("No token provided");
	if (!os || os.length < 1) throw new Error("No os provided");

	if (!osEnum.enumValues.includes(os)) return false;

	try {
		const existing = await db
			.select()
			.from(device)
			.where(eq(device.token, token))
			.limit(1);

		if (existing.length > 0) {
			return true;
		}

		await db.insert(device).values({
			token,
			os,
			createdAt: new Date(),
		});

		return true;
	} catch {
		return false;
	}
}

export async function get(params: GetRequest): Promise<GetResponse>;
export async function get(params: unknown): Promise<GetResponse> {
	validateParams(params);
	const { namespace, resource, filter } = params;

	if (resource === "sdui") {
		if (filter?.id) {
			const rows = await db
				.select({ data: flow.data })
				.from(flow)
				.where(eq(flow.id, filter.id))
				.limit(1);
			return rows.length ? [rows[0].data] : [];
		}
		const flows = await db
			.select({ data: flow.data })
			.from(flow)
			.orderBy(desc(flow.updatedAt));
		return flows.map((f) => f.data);
	}

	const singularResource = pluralize.singular(resource);
	const whereClauses = [
		eq(data.namespace, namespace),
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

export async function upsert(params: unknown): Promise<DATA_Rows> {
	validateParams(params);
	if (
		!("data" in params) ||
		params.data === undefined ||
		typeof params.data !== "object" ||
		params.data === null
	) {
		throw new Error("data is required and must be a non-null object");
	}

	const { namespace, resource, filter, data: dataPayload } = params;
	const now = new Date();

	if (resource === "sdui") {
		const validatedData = validateFlowData(dataPayload);

		if (filter?.id) {
			const result = await db
				.update(flow)
				.set({ data: validatedData, updatedAt: now })
				.where(eq(flow.id, filter.id))
				.returning();
			return formatFlowRow(result[0]);
		}
		const result = await db
			.insert(flow)
			.values({
				data: validatedData,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return formatFlowRow(result[0]);
	}

	const singularResource = pluralize.singular(resource);

	if (filter?.id) {
		const result = await db
			.update(data)
			.set({ data: dataPayload, updatedAt: now })
			.where(
				and(
					eq(data.id, filter.id),
					eq(data.namespace, namespace),
					eq(data.resource, singularResource),
				),
			)
			.returning();
		if (result.length > 0) {
			return formatPersistedDataRow({
				...result[0],
				data: result[0].data as DATA_Data["data"],
			});
		}
	}

	const result = await db
		.insert(data)
		.values({
			namespace,
			resource: singularResource,
			data: dataPayload,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	return formatPersistedDataRow({
		...result[0],
		data: result[0].data as DATA_Data["data"],
	});
}
