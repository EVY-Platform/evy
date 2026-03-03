import { eq, desc } from "drizzle-orm";

import type { DATA_Data, DATA_Rows, OS } from "evy-types/data/data";
import type { GetDataResponse } from "evy-types/rpc/get.response";
import {
	NAMESPACE_VALUES,
	RESOURCE_VALUES,
	type GetRequest,
} from "evy-types/rpc/get.request";
import type { SDUI_Flow } from "evy-types/sdui/evy";
import type { UpsertRequest } from "evy-types/rpc/upsert.request";

import { device, flow, data, osEnum } from "evy-types/db/schema.generated";
import { db } from "./db";
import { validateFlowData } from "./validation";

type Namespace = GetRequest["namespace"];
type Resource = GetRequest["resource"];

function isNamespace(v: unknown): v is Namespace {
	return typeof v === "string" && NAMESPACE_VALUES.includes(v as Namespace);
}
function isNamespacedRecord(v: unknown): v is DATA_Data["data"] {
	if (!isRecord(v)) return false;
	for (const key of Object.keys(v)) {
		if (!isRecord(v[key])) return false;
	}
	return true;
}
export function isResource(v: unknown): v is Resource {
	return typeof v === "string" && RESOURCE_VALUES.includes(v as Resource);
}
export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatRow(row: {
	id: string;
	data: unknown;
	createdAt: Date;
	updatedAt: Date;
}): DATA_Rows {
	return {
		id: row.id,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	} as DATA_Rows;
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

async function getMergedNamespacedData(): Promise<
	Record<Namespace, Partial<Record<Resource, GetDataResponse>>>
> {
	const dataRecords = await db
		.select({ data: data.data })
		.from(data)
		.orderBy(desc(data.updatedAt));
	const merged: Partial<
		Record<Namespace, Partial<Record<Resource, GetDataResponse>>>
	> = {};
	for (const record of dataRecords.reverse()) {
		if (!isNamespacedRecord(record.data)) continue;
		const d = record.data;
		for (const ns of NAMESPACE_VALUES) {
			if (d[ns]) {
				merged[ns] = merged[ns] ?? {};
				Object.assign(merged[ns], d[ns]);
			}
		}
	}
	return {
		evy: merged.evy ?? {},
		marketplace: merged.marketplace ?? {},
	};
}

export async function get(
	params: GetRequest & { resource: "SDUI" },
): Promise<SDUI_Flow[]>;
export async function get(
	params: GetRequest,
): Promise<SDUI_Flow[] | GetDataResponse>;
export async function get(
	params: unknown,
): Promise<SDUI_Flow[] | GetDataResponse> {
	validateParams(params);
	const { namespace, resource, filter } = params;

	if (resource === "SDUI") {
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

	const merged = await getMergedNamespacedData();
	const nsData = merged[namespace] ?? {};
	const value = nsData[resource];
	if (value !== null && value !== undefined) return value;
	return {};
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

	if (resource === "SDUI") {
		const validatedData = validateFlowData(dataPayload);

		if (filter?.id) {
			const result = await db
				.update(flow)
				.set({ data: validatedData, updatedAt: now })
				.where(eq(flow.id, filter.id))
				.returning();
			return formatRow(result[0]);
		}
		const result = await db
			.insert(flow)
			.values({
				data: validatedData,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return formatRow(result[0]);
	}

	const rowPayload: DATA_Data["data"] = {
		evy: {},
		marketplace: {},
	};
	const nsData = rowPayload[namespace];
	if (nsData) {
		(nsData as Record<Resource, GetDataResponse>)[resource] = dataPayload;
	}

	const result = await db
		.insert(data)
		.values({
			data: rowPayload,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	return formatRow(result[0]);
}
