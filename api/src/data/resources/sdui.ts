import { and, asc, eq, gt } from "drizzle-orm";

import type {
	CreateRequest,
	CreateResponse,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	validateCreateResponse,
	validateGetResponse,
	validateUiFlow as validateFlowData,
	validateUpdateResponse,
} from "evy-types/validators";

import { flow } from "../../../../types/generated/ts/db/schema.generated";
import { hasDatabaseErrorCode, type EvyDb } from "../../database/db";

// Queries

export async function getSduiRows(
	db: EvyDb,
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select({ data: flow.data }).from(flow);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(flow.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(flow.updatedAt, filter.updatedAfter));
	}

	const query = whereClauses.length ? base.where(and(...whereClauses)) : base;
	const rows = await query.orderBy(asc(flow.updatedAt), asc(flow.id));
	const payload = rows.map((f) => f.data);
	for (const item of payload) {
		validateFlowData(item);
	}
	return validateGetResponse(payload);
}

// Mutations

export async function createSduiFlow(
	db: EvyDb,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validatedData = validateFlowData(dataPayload);
	const filterId = filter?.id;
	const persistedFlowData =
		filterId && filterId !== validatedData.id
			? { ...validatedData, id: filterId }
			: validatedData;

	const result = await db
		.insert(flow)
		.values({
			id: persistedFlowData.id,
			data: persistedFlowData,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
		.returning()
		.catch((err: unknown) => {
			if (hasDatabaseErrorCode(err, "23505")) {
				throw new Error("Resource already exists");
			}
			throw err;
		});
	const response = validateCreateResponse(result[0]);
	notify(persistedFlowData);
	return response;
}

export async function updateSduiFlow(
	db: EvyDb,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validatedData = validateFlowData(dataPayload);
	const filterId = filter.id;
	const persistedFlowData =
		filterId !== validatedData.id
			? { ...validatedData, id: filterId }
			: validatedData;

	const result = await db
		.update(flow)
		.set({ data: persistedFlowData, updatedAt: nowIso })
		.where(eq(flow.id, filterId))
		.returning();
	if (result.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateUpdateResponse(result[0]);
	notify(persistedFlowData);
	return response;
}
