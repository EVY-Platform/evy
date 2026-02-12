import { eq, desc } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

import { validateFlowData, type ValidatedFlowData } from "./validation";
import {
	db,
	device,
	service,
	organization,
	serviceProvider,
	flow,
	data,
	osEnum,
	type Data,
	type Flow,
	type Service,
	type Organization,
	type ServiceProvider,
	type OS,
} from "./db";

export const NAMESPACES = ["evy", "marketplace"] as const;
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
] as const;

export type Namespace = (typeof NAMESPACES)[number];
export type Resource = (typeof RESOURCES)[number];

export type GetUpsertFilter = { id?: string };
export type GetUpsertParams = {
	namespace: Namespace;
	resource: Resource;
	filter?: GetUpsertFilter;
	data?: Record<string, unknown>;
};

function validateGetUpsertParams(
	params: unknown,
	requireData: boolean,
): asserts params is GetUpsertParams {
	if (params === null || typeof params !== "object") {
		throw new Error("Params must be an object");
	}
	const p = params as Record<string, unknown>;
	if (!p.namespace || !NAMESPACES.includes(p.namespace as Namespace)) {
		throw new Error("Invalid or missing namespace");
	}
	if (!p.resource || !RESOURCES.includes(p.resource as Resource)) {
		throw new Error("Invalid or missing resource");
	}
	if (p.filter !== undefined) {
		if (typeof p.filter !== "object" || p.filter === null) {
			throw new Error("filter must be an object");
		}
	}
	if (requireData) {
		if (p.data === undefined || typeof p.data !== "object" || p.data === null) {
			throw new Error("data is required and must be a non-null object");
		}
	}
}

const tables: Record<string, PgTableWithColumns<any>> = {
	Service: service,
	Organization: organization,
	ServiceProvider: serviceProvider,
	Flow: flow,
	Data: data,
};

const lastTableDataUpdates: {
	[key: string]: Date;
} = {};

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
	const modelNames = Object.keys(tables).filter(
		(model) => model !== "Device",
	);

	await Promise.all(
		modelNames.map(async (model: string) => {
			const table = tables[model];
			if (!table) return;

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

/** Merge all Data rows by updatedAt (later wins), return top-level namespace/resource structure */
async function getMergedNamespacedData(): Promise<
	Record<Namespace, Record<string, unknown>>
> {
	const dataRecords = await db
		.select({ data: data.data })
		.from(data)
		.orderBy(desc(data.updatedAt));
	const merged: Record<string, Record<string, unknown>> = {};
	for (const record of dataRecords.reverse()) {
		const d = record.data as Record<string, Record<string, unknown>>;
		for (const ns of NAMESPACES) {
			if (d[ns] && typeof d[ns] === "object") {
				merged[ns] = merged[ns] || {};
				Object.assign(merged[ns], d[ns]);
			}
		}
	}
	return merged as Record<Namespace, Record<string, unknown>>;
}

export async function get(
	params: unknown,
): Promise<ValidatedFlowData[] | Record<string, unknown>> {
	validateGetUpsertParams(params, false);
	const { namespace, resource, filter } = params as GetUpsertParams;

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
	return (typeof value === "object" && value !== null
		? value
		: {}) as Record<string, unknown>;
}

export async function upsert(
	params: unknown,
): Promise<Flow | Data | Record<string, unknown>> {
	validateGetUpsertParams(params, true);
	const { namespace, resource, filter, data: dataPayload } =
		params as GetUpsertParams;
	const dataObj = dataPayload!;

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
			return result[0];
		}
		const result = await db
			.insert(flow)
			.values({
				data: validatedData,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return result[0];
	}

	const now = new Date();
	const rowPayload: Record<Namespace, Record<string, unknown>> = {
		evy: {},
		marketplace: {},
	};
	rowPayload[namespace][resource] = dataObj;

	const result = await db
		.insert(data)
		.values({
			data: rowPayload,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	return result[0];
}
