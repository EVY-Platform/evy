import { v4 as uuidv4 } from "uuid";
import { eq, gt, desc } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

import { isCorrectDate } from "./utils";
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

type Model = Service | Organization | ServiceProvider;
type AnyData = {
	[key: string]: AnyData | string | number | boolean | Date;
};
export enum CRUD {
	find = "find",
	create = "create",
	update = "update",
	delete = "delete",
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

export async function crud(
	method: CRUD,
	model: string,
	filter?: AnyData,
	data?: AnyData,
): Promise<Model[]> {
	if (!method || !(method in CRUD)) throw new Error("Invalid CRUD method");
	if (!lastTableDataUpdates[model]) {
		throw new Error("Invalid model provided");
	}
	if (!data || Object.keys(data).length < 1) {
		if (method === CRUD.create) throw new Error("No data provided");
		if (method === CRUD.update) throw new Error("No data provided");
	}
	if (!filter || Object.keys(filter).length < 1) {
		if (method === CRUD.find) throw new Error("No filter provided");
		if (method === CRUD.update) throw new Error("No filter provided");
		if (method === CRUD.delete) throw new Error("No filter provided");
	}

	const table = tables[model];
	if (!table) throw new Error("Invalid model provided");

	const getColumn = (columnName: string) => {
		if (!(columnName in table)) {
			throw new Error(`Invalid filter key: ${columnName}`);
		}
		return table[columnName as keyof typeof table & string];
	};

	try {
		if (method === CRUD.find) {
			const filterKey = Object.keys(filter!)[0];
			const filterValue = filter![filterKey];
			const column = getColumn(filterKey);
			return (await db
				.select()
				.from(table)
				.where(eq(column, filterValue))) as Model[];
		}

		if (method === CRUD.create) {
			const insertData = {
				id: uuidv4(),
				...data,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const result = await db
				.insert(table)
				.values(insertData)
				.returning();
			return result as Model[];
		}

		if (method === CRUD.update) {
			const filterKey = Object.keys(filter!)[0];
			const filterValue = filter![filterKey];
			const column = getColumn(filterKey);
			const updateData = { ...data, updatedAt: new Date() };
			const result = await db
				.update(table)
				.set(updateData)
				.where(eq(column, filterValue))
				.returning();
			return result as Model[];
		}

		if (method === CRUD.delete) {
			const filterKey = Object.keys(filter!)[0];
			const filterValue = filter![filterKey];
			const column = getColumn(filterKey);
			const result = await db
				.delete(table)
				.where(eq(column, filterValue))
				.returning();
			return result as Model[];
		}

		return [];
	} catch (e) {
		const error = e as { code?: string; message?: string };
		if (error.code) throw new Error(error.code);
		if (error.message?.includes("is missing"))
			throw new Error(error.message);
		throw new Error(String(e));
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

export async function getSDUI(since?: Date): Promise<ValidatedFlowData[]> {
	const sinceDate =
		since && isCorrectDate(new Date(since)) ? new Date(since) : undefined;

	const flows = await db
		.select({ data: flow.data })
		.from(flow)
		.where(sinceDate ? gt(flow.updatedAt, sinceDate) : undefined)
		.orderBy(desc(flow.updatedAt));

	return flows.map((f) => f.data);
}

export async function saveFlow(
	flowData: unknown,
	existingFlowId?: string,
): Promise<Flow> {
	const validatedData = validateFlowData(flowData);

	const now = new Date();

	if (existingFlowId) {
		const result = await db
			.update(flow)
			.set({
				data: validatedData,
				updatedAt: now,
			})
			.where(eq(flow.id, existingFlowId))
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

export async function getData(since?: Date): Promise<Record<string, unknown>> {
	const sinceDate =
		since && isCorrectDate(new Date(since)) ? new Date(since) : undefined;

	const dataRecords = await db
		.select({ data: data.data })
		.from(data)
		.where(sinceDate ? gt(data.updatedAt, sinceDate) : undefined)
		.orderBy(desc(data.updatedAt));

	// Merge all data records into a single object
	// Later records override earlier ones for any conflicting keys
	const mergedData: Record<string, unknown> = {};
	for (const record of dataRecords.reverse()) {
		Object.assign(mergedData, record.data);
	}

	return mergedData;
}

export async function saveData(
	dataPayload: unknown,
	existingDataId?: string,
): Promise<Data> {
	if (typeof dataPayload !== "object" || dataPayload === null) {
		throw new Error("Data payload must be a non-null object");
	}
	const serviceData = dataPayload as Record<string, unknown>;

	const now = new Date();

	if (existingDataId) {
		const result = await db
			.update(data)
			.set({
				data: serviceData,
				updatedAt: now,
			})
			.where(eq(data.id, existingDataId))
			.returning();
		return result[0];
	} else {
		const result = await db
			.insert(data)
			.values({
				data: serviceData,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return result[0];
	}
}
