import { v4 as uuidv4 } from "uuid";
import { eq, gt, desc } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

import { isCorrectDate } from "./utils";
import {
	db,
	device,
	service,
	organization,
	serviceProvider,
	flow,
	osEnum,
	type Service,
	type Organization,
	type ServiceProvider,
	type OS,
} from "./db";

type Model = Service | Organization | ServiceProvider;
type ModelsDictionary = {
	[key: string]: Model[];
};
type AnyData = {
	[key: string]: AnyData | string | number | boolean | Date;
};
enum CRUD {
	find = "find",
	create = "create",
	update = "update",
	delete = "delete",
}

// Table mapping for dynamic access
const tables: Record<string, PgTableWithColumns<any>> = {
	Service: service,
	Organization: organization,
	ServiceProvider: serviceProvider,
	Flow: flow,
};

const lastTableDataUpdates: {
	[key: string]: Date;
} = {};

export async function validateAuth(token: string, os: OS): Promise<boolean> {
	if (!token || token.length < 1) throw new Error("No token provided");
	if (!os || os.length < 1) throw new Error("No os provided");

	if (!osEnum.enumValues.includes(os)) return false;

	try {
		// Check if device exists
		const existing = await db
			.select()
			.from(device)
			.where(eq(device.token, token))
			.limit(1);

		if (existing.length > 0) {
			return true;
		}

		// Create new device
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

	try {
		if (method === CRUD.find) {
			// Build where clause from filter
			const filterKey = Object.keys(filter!)[0];
			const filterValue = filter![filterKey];
			const column = table[filterKey as keyof typeof table];
			if (!column) throw new Error(`Invalid filter key: ${filterKey}`);
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
			const result = await db.insert(table).values(insertData).returning();
			return result as Model[];
		}

		if (method === CRUD.update) {
			const filterKey = Object.keys(filter!)[0];
			const filterValue = filter![filterKey];
			const column = table[filterKey as keyof typeof table];
			if (!column) throw new Error(`Invalid filter key: ${filterKey}`);
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
			const column = table[filterKey as keyof typeof table];
			if (!column) throw new Error(`Invalid filter key: ${filterKey}`);
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
		if (error.message?.includes("is missing")) throw new Error(error.message);
		throw new Error(String(e));
	}
}

export async function getNewDataSince(since?: Date): Promise<ModelsDictionary> {
	const hasValidSince = since && isCorrectDate(new Date(since));
	const relevantTables = Object.keys(lastTableDataUpdates).filter(
		(model: string) => {
			if (!hasValidSince) return true;
			return lastTableDataUpdates[model] > since;
		},
	);

	const results = await Promise.all(
		relevantTables.map(async (model: string) => {
			const table = tables[model];
			if (!table) return [];

			if (hasValidSince) {
				return db
					.select()
					.from(table)
					.where(gt(table.updatedAt, new Date(since)));
			}
			return db.select().from(table);
		}),
	);

	return relevantTables.reduce(
		(obj, tableName, index) => {
			obj[tableName] = results[index] as Model[];
			return obj;
		},
		{} as ModelsDictionary,
	);
}

export async function primeData() {
	const modelNames = Object.keys(tables).filter((model) => model !== "Device");

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

type FlowData = {
	name: string;
	type: string;
	data: string;
	pages: unknown[];
};

type FlowResponse = {
	id: string;
	name: string;
	type: string;
	data: string;
	pages: unknown[];
};

export async function getFlows(since?: Date): Promise<FlowResponse[]> {
	const hasValidSince = since && isCorrectDate(new Date(since));

	let flows;
	if (hasValidSince) {
		flows = await db
			.select()
			.from(flow)
			.where(gt(flow.updatedAt, new Date(since)))
			.orderBy(desc(flow.updatedAt));
	} else {
		flows = await db.select().from(flow).orderBy(desc(flow.updatedAt));
	}

	return flows.map((f) => {
		const flowData = f.data as FlowData;
		return {
			id: f.id,
			name: flowData.name,
			type: flowData.type,
			data: flowData.data,
			pages: flowData.pages,
		};
	});
}

export async function saveFlow(
	flowData: FlowData,
	existingFlowId?: string,
): Promise<FlowResponse> {
	const now = new Date();

	let savedFlow;
	if (existingFlowId) {
		const result = await db
			.update(flow)
			.set({
				data: flowData,
				updatedAt: now,
			})
			.where(eq(flow.id, existingFlowId))
			.returning();
		savedFlow = result[0];
	} else {
		const result = await db
			.insert(flow)
			.values({
				data: flowData,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		savedFlow = result[0];
	}

	const savedFlowData = savedFlow.data as FlowData;
	return {
		id: savedFlow.id,
		name: savedFlowData.name,
		type: savedFlowData.type,
		data: savedFlowData.data,
		pages: savedFlowData.pages,
	};
}
