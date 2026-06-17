import { and, asc, eq, gt } from "drizzle-orm";

import type {
	GetResponse,
	GetRequest,
	CreateRequest,
	CreateResponse,
	UpdateRequest,
	UpdateResponse,
	DeleteRequest,
	DeleteResponse,
} from "evy-types";
import {
	validateGetResponse,
	validateCreateResponse,
	validateUpdateResponse,
	validateDeleteResponse,
} from "evy-types/validators";

import type {
	service,
	organization,
	serviceProvider,
	file,
} from "../../../../types/generated/ts/db/schema.generated";
import { hasDatabaseErrorCode } from "../../database/db";
import type { EvyDb } from "../../database/db";

export type ResourceTable =
	| typeof service
	| typeof organization
	| typeof serviceProvider
	| typeof file;

export type ResourceEntityConfig<TValidated> = {
	table: ResourceTable;
	validate: (data: unknown) => TValidated;
	toUpdateSet: (
		validated: TValidated,
		nowIso: string,
	) => Record<string, unknown>;
	toInsertValues: (
		validated: TValidated,
		nowIso: string,
		filterId: string | undefined,
	) => Record<string, unknown>;
	mapRow: (row: unknown) => unknown;
};

export async function listCoreResourceRows<TRow>(
	db: EvyDb,
	table: ResourceTable,
	filter: GetRequest["filter"] | undefined,
	mapRow: (r: TRow) => unknown,
): Promise<GetResponse> {
	const base = db.select().from(table);
	const whereClauses: ReturnType<typeof eq>[] = [];

	if (filter?.id) {
		whereClauses.push(eq(table.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(table.updatedAt, filter.updatedAfter));
	}

	const rows = whereClauses.length
		? await base
				.where(and(...whereClauses))
				.orderBy(asc(table.updatedAt), asc(table.id))
		: await base.orderBy(asc(table.updatedAt), asc(table.id));
	return validateGetResponse(rows.map((r) => mapRow(r as TRow)));
}

export async function insertResourceEntityFromConfig<TValidated>(
	db: EvyDb,
	config: ResourceEntityConfig<TValidated>,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter?.id;

	// biome-ignore lint/suspicious/noExplicitAny: union ResourceTable needs concrete table at each config site
	const inserted = await (db.insert(config.table as any) as any)
		.values(config.toInsertValues(validated, nowIso, filterId))
		.returning()
		.catch((err: unknown) => {
			if (hasDatabaseErrorCode(err, "23505")) {
				throw new Error("Resource already exists");
			}
			throw err;
		});
	const response = validateCreateResponse(config.mapRow(inserted[0]));

	notify(response);
	return response;
}

export async function updateResourceEntityFromConfig<TValidated>(
	db: EvyDb,
	config: ResourceEntityConfig<TValidated>,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter.id;

	// biome-ignore lint/suspicious/noExplicitAny: union ResourceTable needs concrete table at each config site
	const updated = await (db.update(config.table as any) as any)
		.set(config.toUpdateSet(validated, nowIso))
		.where(eq(config.table.id, filterId))
		.returning();
	if (updated.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateUpdateResponse(config.mapRow(updated[0]));

	notify(response);
	return response;
}

export async function deleteResourceEntityFromConfig<TValidated>(
	db: EvyDb,
	config: ResourceEntityConfig<TValidated>,
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const filterId = filter.id;

	// biome-ignore lint/suspicious/noExplicitAny: union ResourceTable needs concrete table at each config site
	const deleted = await (db.delete(config.table as any) as any)
		.where(eq(config.table.id, filterId))
		.returning();
	if (deleted.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateDeleteResponse(config.mapRow(deleted[0]));

	notify(response);
	return response;
}
