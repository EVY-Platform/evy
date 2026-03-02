import { eq, desc } from "drizzle-orm";

import type { DATA_Data, DATA_Flow, DATA_Rows, OS } from "evy-types/data/data";
import type { GetDataResponse } from "evy-types/rpc/get.response";
import type { GetRequest } from "evy-types/rpc/get.request";
import type { SDUI_Flow } from "evy-types/sdui/evy";
import type { UpsertRequest } from "evy-types/rpc/upsert.request";

import {
	device,
	service,
	organization,
	serviceProvider,
	flow,
	data,
	osEnum,
} from "evy-types/db/schema.generated";
import { db } from "./db";
import { isRecord } from "./utils";
import { validateFlowData } from "./validation";

export type Namespace = GetRequest["namespace"];
export type Resource = GetRequest["resource"];

export const NAMESPACES = [
	"evy",
	"marketplace",
] as const satisfies readonly Namespace[];
export const RESOURCES = [
	"SDUI",
	"Device",
	"Organisation",
	"Service",
	"Provider",
	"SellingReason",
	"Conditions",
	"Durations",
	"Items",
] as const satisfies readonly Resource[];

function isNamespace(v: unknown): v is Namespace {
	return typeof v === "string" && NAMESPACES.includes(v as Namespace);
}
export function isResource(v: unknown): v is Resource {
	return typeof v === "string" && RESOURCES.includes(v as Resource);
}

function getParamsRecord(
	params: unknown,
): asserts params is Record<string, unknown> {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
}

function validateGetUpsertParams(
	params: unknown,
	requireData: boolean,
): asserts params is GetRequest | UpsertRequest {
	getParamsRecord(params);
	if (!("namespace" in params) || !isNamespace(params.namespace)) {
		throw new Error("Invalid or missing namespace");
	}
	if (!("resource" in params) || !isResource(params.resource)) {
		throw new Error("Invalid or missing resource");
	}
	if (params.filter !== undefined) {
		if (typeof params.filter !== "object" || params.filter === null) {
			throw new Error("filter must be an object");
		}
	}
	if (!requireData) return;
	if (
		params.data === undefined ||
		typeof params.data !== "object" ||
		params.data === null
	) {
		throw new Error("data is required and must be a non-null object");
	}
}

const tables = {
	Service: service,
	Organization: organization,
	ServiceProvider: serviceProvider,
	Flow: flow,
	Data: data,
} as const;
type TableName = keyof typeof tables;

const lastTableDataUpdates: Partial<Record<TableName, Date>> = {};

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

export async function primeData() {
	const modelNames = Object.keys(tables) as TableName[];

	await Promise.all(
		modelNames.map(async (model) => {
			const table = tables[model];

			const lastUpdate = await db
				.select({ updatedAt: table.updatedAt })
				.from(table)
				.orderBy(desc(table.updatedAt))
				.limit(1);

			lastTableDataUpdates[model] =
				lastUpdate.length > 0 ? lastUpdate[0].updatedAt : new Date(0);
		}),
	);
}

function isNamespacedRecord(v: unknown): v is DATA_Data["data"] {
	if (!isRecord(v)) return false;
	for (const key of Object.keys(v)) {
		if (!isRecord(v[key])) return false;
	}
	return true;
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
		for (const ns of NAMESPACES) {
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
	validateGetUpsertParams(params, false);
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

/** Map Flow table row (Date timestamps) to API DATA_Flow (string timestamps). */
function toFlowRow(row: {
	id: string;
	data: SDUI_Flow;
	createdAt: Date;
	updatedAt: Date;
}): DATA_Flow {
	return {
		id: row.id,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/** Map Data table row (Date timestamps) to API DATA_Data (string timestamps). */
function toDataRow(row: {
	id: string;
	data: DATA_Data["data"];
	createdAt: Date;
	updatedAt: Date;
}): DATA_Data {
	return {
		id: row.id,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function isUpsertRequest(p: GetRequest | UpsertRequest): p is UpsertRequest {
	return "data" in p && p.data !== undefined;
}

export async function upsert(params: unknown): Promise<DATA_Rows> {
	validateGetUpsertParams(params, true);
	if (!isUpsertRequest(params)) {
		throw new Error("data is required and must be a non-null object");
	}
	const { namespace, resource, filter, data: dataPayload } = params;
	const dataObj = dataPayload;

	if (resource === "SDUI") {
		const validatedData = validateFlowData(dataObj);
		const now = new Date();
		const existingId = filter?.id;

		if (existingId) {
			const result = await db
				.update(flow)
				.set({ data: validatedData, updatedAt: now })
				.where(eq(flow.id, existingId))
				.returning();
			const row = result[0];
			return toFlowRow({
				id: row.id,
				data: row.data,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			});
		}
		const result = await db
			.insert(flow)
			.values({
				data: validatedData,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		const row = result[0];
		return toFlowRow({
			id: row.id,
			data: row.data,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	const now = new Date();
	const rowPayload: DATA_Data["data"] = {
		evy: {},
		marketplace: {},
	};
	const nsData = rowPayload[namespace];
	if (nsData) nsData[resource] = dataObj;

	const result = await db
		.insert(data)
		.values({
			data: rowPayload,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	const row = result[0];
	return toDataRow({
		id: row.id,
		data: row.data,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}
