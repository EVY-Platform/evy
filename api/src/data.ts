import { and, asc, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type {
	DATA_EVY_Organization,
	DATA_EVY_Service,
	DATA_EVY_ServiceProvider,
	DATA_EVY_Image,
	GetResponse,
	GetRequest,
	OS,
	CreateRequest,
	CreateResponse,
	UpdateRequest,
	UpdateResponse,
	DeleteRequest,
	DeleteResponse,
} from "evy-types";
import * as schema from "../../types/generated/ts/db/schema.generated";
import {
	device,
	flow,
	service,
	organization,
	serviceProvider,
	image,
	osEnum,
} from "../../types/generated/ts/db/schema.generated";
import { getConnectionUrl } from "./db";
import {
	deleteImageBinary,
	deleteImageBinaryIfExists,
	readImageBinary,
	writeImageBinary,
} from "./imageFiles";
import { emitDataChangedNotification } from "./notifications";
import {
	deleteUploadSession,
	getUploadSession,
	uploadSessionToBuffer,
} from "./uploads";
import {
	EVY_CORE_SERVICE,
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAME_SET,
} from "evy-types/coreResources";
import {
	validateDataEvyOrganization as validateOrganizationPayload,
	validateDataEvyService as validateServicePayload,
	validateDataEvyServiceProvider as validateServiceProviderPayload,
	validateDataEvyImage as validateImagePayload,
	validateGetResponse,
	validateUiFlow as validateFlowData,
	validateCreateResponse,
	validateUpdateResponse,
	validateDeleteResponse,
	validateGetImageParams,
} from "evy-types/validators";

const evyCoreResourceNameSet: ReadonlySet<string> = EVY_CORE_RESOURCE_NAME_SET;

const connectionString = getConnectionUrl();
const client = postgres(connectionString);

let db = drizzle(client, { schema });

export function setDbForTest(database: typeof db): void {
	db = database;
}

function assertEvyCoreAccess(
	params: GetRequest | CreateRequest | UpdateRequest | DeleteRequest,
): void {
	if (params.service !== EVY_CORE_SERVICE) {
		throw new Error("Core API only serves service evy");
	}
	if (!evyCoreResourceNameSet.has(params.resource)) {
		throw new Error("Resource is not served by the core API");
	}
}

function hasDatabaseErrorCode(err: unknown, code: string): boolean {
	if (typeof err !== "object" || err === null) {
		return false;
	}

	if ("code" in err && err.code === code) {
		return true;
	}

	return "cause" in err && hasDatabaseErrorCode(err.cause, code);
}

export async function get(params: GetRequest): Promise<GetResponse> {
	assertEvyCoreAccess(params);
	return getCoreBody(params);
}

export async function create(params: CreateRequest): Promise<CreateResponse> {
	assertEvyCoreAccess(params);
	return createCoreBody(params);
}

export async function update(params: UpdateRequest): Promise<UpdateResponse> {
	assertEvyCoreAccess(params);
	return updateCoreBody(params);
}

async function deleteResource(params: DeleteRequest): Promise<DeleteResponse> {
	assertEvyCoreAccess(params);
	return deleteCoreBody(params);
}
export { deleteResource as delete }; // We have to do this because of JS

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

type CatalogTable =
	| typeof service
	| typeof organization
	| typeof serviceProvider
	| typeof image;

type CatalogEntityConfig<TValidated> = {
	table: CatalogTable;
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

async function listCoreCatalogRows<TRow>(
	table: CatalogTable,
	filter: GetRequest["filter"] | undefined,
	mapRow: (r: TRow) => unknown,
): Promise<GetResponse> {
	const base = db.select().from(table);
	const whereClauses = [];

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

async function insertCatalogEntityFromConfig<TValidated>(
	config: CatalogEntityConfig<TValidated>,
	filter: CreateRequest["filter"] | undefined,
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<CreateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter?.id;

	// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
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

async function updateCatalogEntityFromConfig<TValidated>(
	config: CatalogEntityConfig<TValidated>,
	filter: UpdateRequest["filter"],
	dataPayload: unknown,
	nowIso: string,
	notify: (value: unknown) => void,
): Promise<UpdateResponse> {
	const validated = config.validate(dataPayload);
	const filterId = filter.id;

	// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
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

async function deleteCatalogEntityFromConfig<TValidated>(
	config: CatalogEntityConfig<TValidated>,
	filter: DeleteRequest["filter"],
	notify: (value: unknown) => void,
): Promise<DeleteResponse> {
	const filterId = filter.id;

	// biome-ignore lint/suspicious/noExplicitAny: union CatalogTable needs concrete table at each config site
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
			createdAt: new Date().toISOString(),
		});

		return true;
	} catch (err) {
		console.warn("validateAuth: unexpected error", err);
		return false;
	}
}

async function getCoreBody(params: GetRequest): Promise<GetResponse> {
	const { resource, filter } = params;

	if (resource === EVY_CORE_RESOURCE.DEVICES) {
		throw new Error("devices are managed via validateAuth only");
	}

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		const base = db.select({ data: flow.data }).from(flow);
		const whereClauses = [];

		if (filter?.id) {
			whereClauses.push(eq(flow.id, filter.id));
		}
		if (filter?.updatedAfter) {
			whereClauses.push(gt(flow.updatedAt, filter.updatedAfter));
		}

		const rows = whereClauses.length
			? await base
					.where(and(...whereClauses))
					.orderBy(asc(flow.updatedAt), asc(flow.id))
			: await base.orderBy(asc(flow.updatedAt), asc(flow.id));
		const payload = rows.map((f) => f.data);
		for (const item of payload) {
			validateFlowData(item);
		}
		return validateGetResponse(payload);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return listCoreCatalogRows(service, filter, mapServiceRow);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return listCoreCatalogRows(organization, filter, (r) => r);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return listCoreCatalogRows(serviceProvider, filter, (r) => r);
	}

	if (resource === EVY_CORE_RESOURCE.IMAGES) {
		return listImageRowsWithBinary(filter);
	}

	throw new Error("Unsupported resource for core API");
}

const serviceCatalogConfig: CatalogEntityConfig<DATA_EVY_Service> = {
	table: service,
	validate: validateServicePayload,
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

const organizationCatalogConfig: CatalogEntityConfig<DATA_EVY_Organization> = {
	table: organization,
	validate: validateOrganizationPayload,
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

const providerCatalogConfig: CatalogEntityConfig<DATA_EVY_ServiceProvider> = {
	table: serviceProvider,
	validate: validateServiceProviderPayload,
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

const imageCatalogConfig: CatalogEntityConfig<DATA_EVY_Image> = {
	table: image,
	validate: validateImagePayload,
	toUpdateSet: (validated, nowIso) => ({
		type: validated.type,
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

type PreparedImageUpload = {
	imageId: string;
	imageType: DATA_EVY_Image["type"];
	dataPayload: DATA_EVY_Image;
};

async function createImageFromUpload(params: {
	filter: CreateRequest["filter"] | undefined;
	dataPayload: unknown;
	nowIso: string;
}): Promise<PreparedImageUpload> {
	const validated = validateImagePayload(params.dataPayload);
	const imageId = params.filter?.id ?? validated.id;
	const uploadSession = getUploadSession(imageId);

	if (!uploadSession) {
		throw new Error(`No upload found for image id: ${imageId}`);
	}
	if (uploadSession.type !== validated.type) {
		throw new Error(
			`Upload type mismatch: upload has ${uploadSession.type}, image data has ${validated.type}`,
		);
	}

	const imageBuffer = uploadSessionToBuffer(uploadSession);
	await writeImageBinary({
		id: imageId,
		type: validated.type,
		bytes: imageBuffer,
	});
	deleteUploadSession(imageId);

	return {
		imageId,
		imageType: validated.type,
		dataPayload: {
			...validated,
			id: imageId,
			createdAt: params.nowIso,
			updatedAt: params.nowIso,
		},
	};
}

async function createCoreBody(params: CreateRequest): Promise<CreateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	function emitNotification(value: unknown): void {
		emitDataChangedNotification({
			service: EVY_CORE_SERVICE,
			resource,
			operation: "create",
			value,
		});
	}

	if (resource === EVY_CORE_RESOURCE.SDUI) {
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
			.catch((err) => {
				if (hasDatabaseErrorCode(err, "23505")) {
					throw new Error("Resource already exists");
				}
				throw err;
			});
		const response = validateCreateResponse(result[0]);
		emitNotification(persistedFlowData);
		return response;
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return insertCatalogEntityFromConfig(
			serviceCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return insertCatalogEntityFromConfig(
			organizationCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return insertCatalogEntityFromConfig(
			providerCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.IMAGES) {
		const preparedImage = await createImageFromUpload({
			filter,
			dataPayload,
			nowIso,
		});

		try {
			return await insertCatalogEntityFromConfig(
				imageCatalogConfig,
				filter,
				preparedImage.dataPayload,
				nowIso,
				emitNotification,
			);
		} catch (err) {
			await deleteImageBinaryIfExists({
				id: preparedImage.imageId,
				type: preparedImage.imageType,
			});
			throw err;
		}
	}

	throw new Error("Create is not supported for this resource");
}

async function updateCoreBody(params: UpdateRequest): Promise<UpdateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();

	function emitNotification(value: unknown): void {
		emitDataChangedNotification({
			service: EVY_CORE_SERVICE,
			resource,
			operation: "update",
			value,
		});
	}

	if (resource === EVY_CORE_RESOURCE.SDUI) {
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
		emitNotification(persistedFlowData);
		return response;
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return updateCatalogEntityFromConfig(
			serviceCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return updateCatalogEntityFromConfig(
			organizationCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return updateCatalogEntityFromConfig(
			providerCatalogConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	throw new Error("Update is not supported for this resource");
}

async function deleteCoreBody(params: DeleteRequest): Promise<DeleteResponse> {
	const { resource, filter } = params;

	function emitNotification(value: unknown): void {
		emitDataChangedNotification({
			service: EVY_CORE_SERVICE,
			resource,
			operation: "delete",
			value,
		});
	}

	if (resource === EVY_CORE_RESOURCE.IMAGES) {
		const metadata = await selectImageRowById(filter.id);
		try {
			await deleteImageBinary({ id: metadata.id, type: metadata.type });
		} catch {
			// Binary already missing — still clean up metadata to avoid orphan.
		}

		return deleteCatalogEntityFromConfig(
			imageCatalogConfig,
			filter,
			emitNotification,
		);
	}

	throw new Error("Delete is not supported for this resource");
}

async function selectImageRowById(id: string): Promise<DATA_EVY_Image> {
	const rows = await db.select().from(image).where(eq(image.id, id)).limit(1);
	if (rows.length === 0) {
		throw new Error("Image not found");
	}
	return rows[0] as DATA_EVY_Image;
}
export interface GetImageResponse {
	id: string;
	type: string;
	createdAt: string;
	updatedAt: string;
	dataBase64: string;
}

async function imageRowToGetImageResponse(
	metadata: DATA_EVY_Image,
): Promise<GetImageResponse> {
	let fileData: Buffer;
	try {
		fileData = await readImageBinary({
			id: metadata.id,
			type: metadata.type,
		});
	} catch {
		throw new Error(`Image binary not found for id: ${metadata.id}`);
	}

	return {
		id: metadata.id,
		type: metadata.type,
		createdAt: metadata.createdAt,
		updatedAt: metadata.updatedAt,
		dataBase64: fileData.toString("base64"),
	};
}

async function listImageRowsWithBinary(
	filter: GetRequest["filter"] | undefined,
): Promise<GetResponse> {
	const base = db.select().from(image);
	const whereClauses = [];

	if (filter?.id) {
		whereClauses.push(eq(image.id, filter.id));
	}
	if (filter?.updatedAfter) {
		whereClauses.push(gt(image.updatedAt, filter.updatedAfter));
	}

	const rows = whereClauses.length
		? await base
				.where(and(...whereClauses))
				.orderBy(asc(image.updatedAt), asc(image.id))
		: await base.orderBy(asc(image.updatedAt), asc(image.id));
	const response = await Promise.all(
		rows.map((row) => imageRowToGetImageResponse(row as DATA_EVY_Image)),
	);
	return validateGetResponse(response);
}

export async function getImage(params: unknown): Promise<GetImageResponse> {
	const validated = validateGetImageParams(params);
	const metadata = await selectImageRowById(validated.id);
	return imageRowToGetImageResponse(metadata);
}
