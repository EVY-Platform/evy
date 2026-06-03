import { and, asc, eq, gt } from "drizzle-orm";

import type {
	DATA_EVY_File,
	DATA_EVY_Organization,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
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
	validateDataEvyFile,
	validateDataEvyOrganization,
	validateDataEvyService,
	validateDataEvyServiceProvider,
	validateGetResponse,
	validateCreateResponse,
	validateUpdateResponse,
	validateDeleteResponse,
} from "evy-types/validators";

import {
	service,
	organization,
	serviceProvider,
	file,
} from "../../../types/generated/ts/db/schema.generated";
import { getDb, hasDatabaseErrorCode } from "./db";

type ResourceTable =
	| typeof service
	| typeof organization
	| typeof serviceProvider
	| typeof file;

type ResourceEntityConfig<TValidated> = {
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

export type { ResourceTable, ResourceEntityConfig };

function mapServiceRow(r: typeof service.$inferSelect): DATA_EVY_Service {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		...(r.sortOrder !== null ? { sortOrder: r.sortOrder } : {}),
		...(r.defaultWeightKg !== null
			? { defaultWeightKg: r.defaultWeightKg }
			: {}),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

const serviceResourceConfig: ResourceEntityConfig<DATA_EVY_Service> = {
	table: service,
	validate: validateDataEvyService,
	toUpdateSet: (validated, nowIso) => ({
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
		defaultWeightKg: validated.defaultWeightKg ?? null,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		name: validated.name,
		description: validated.description,
		sortOrder: validated.sortOrder ?? null,
		defaultWeightKg: validated.defaultWeightKg ?? null,
		createdAt: validated.createdAt,
		updatedAt: nowIso,
	}),
	mapRow: (row: unknown) => mapServiceRow(row as typeof service.$inferSelect),
};

const organizationResourceConfig: ResourceEntityConfig<DATA_EVY_Organization> =
	{
		table: organization,
		validate: validateDataEvyOrganization,
		toUpdateSet: (validated, nowIso) => ({
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			supportEmail: validated.supportEmail,
			updatedAt: nowIso,
		}),
		toInsertValues: (validated, nowIso, filterId) => ({
			id: filterId ?? validated.id,
			name: validated.name,
			description: validated.description,
			logo: validated.logo,
			url: validated.url,
			supportEmail: validated.supportEmail,
			createdAt: validated.createdAt,
			updatedAt: nowIso,
		}),
		mapRow: (row) => row,
	};

const providerResourceConfig: ResourceEntityConfig<DATA_EVY_ServiceProvider> = {
	table: serviceProvider,
	validate: validateDataEvyServiceProvider,
	toUpdateSet: (validated, nowIso) => ({
		fkServiceId: validated.fkServiceId,
		fkOrganizationId: validated.fkOrganizationId,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		retired: validated.retired,
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		fkServiceId: validated.fkServiceId,
		fkOrganizationId: validated.fkOrganizationId,
		name: validated.name,
		description: validated.description,
		logo: validated.logo,
		url: validated.url,
		createdAt: validated.createdAt,
		updatedAt: nowIso,
		retired: validated.retired,
	}),
	mapRow: (row) => row,
};

const fileResourceConfig: ResourceEntityConfig<DATA_EVY_File> = {
	table: file,
	validate: validateDataEvyFile,
	toUpdateSet: (_validated, nowIso) => ({
		updatedAt: nowIso,
	}),
	toInsertValues: (validated, nowIso, filterId) => ({
		id: filterId ?? validated.id,
		type: validated.type,
		createdAt: nowIso,
		updatedAt: nowIso,
	}),
	mapRow: (row) => row,
};

export {
	mapServiceRow,
	serviceResourceConfig,
	organizationResourceConfig,
	providerResourceConfig,
	fileResourceConfig,
};

export async function listCoreResourceRows<TRow>(
	table: ResourceTable,
	filter: GetRequest["filter"] | undefined,
	mapRow: (r: TRow) => unknown,
): Promise<GetResponse> {
	const base = getDb().select().from(table);
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
	config: ResourceEntityConfig<TValidated>,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter?.id;

	// biome-ignore lint/suspicious/noExplicitAny: union ResourceTable needs concrete table at each config site
	const inserted = await (getDb().insert(config.table as any) as any)
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
	config: ResourceEntityConfig<TValidated>,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter.id;

	// biome-ignore lint/suspicious/noExplicitAny: union ResourceTable needs concrete table at each config site
	const updated = await (getDb().update(config.table as any) as any)
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
	config: ResourceEntityConfig<TValidated>,
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const filterId = filter.id;

	// biome-ignore lint/suspicious/noExplicitAny: union ResourceTable needs concrete table at each config site
	const deleted = await (getDb().delete(config.table as any) as any)
		.where(eq(config.table.id, filterId))
		.returning();
	if (deleted.length === 0) {
		throw new Error("Resource not found");
	}
	const response = validateDeleteResponse(config.mapRow(deleted[0]));

	notify(response);
	return response;
}
