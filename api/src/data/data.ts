import { asc, eq, ne } from "drizzle-orm";
import type {
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
	OS,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAME_SET,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import {
	service,
	serviceResource,
} from "../../../types/generated/ts/db/schema.generated";
import type { EvyDb } from "../database/db";
import { DATA_CHANGED_EVENT } from "../shared/ws";

import { validateAuth as validateDeviceAuth } from "./resources/devices";
import {
	createFileResource,
	deleteFileResource,
	listFileRowsWithBinary,
} from "./resources/files";
import {
	createFlowResource,
	deleteFlowResource,
	listFlowRows,
	updateFlowResource,
} from "./resources/flows";
import {
	createOrganizationResource,
	listOrganizationRows,
	updateOrganizationResource,
} from "./resources/organisation";
import {
	createPageResource,
	deletePageResource,
	listPageRows,
	updatePageResource,
} from "./resources/pages";
import {
	createRowResource,
	deleteRowResource,
	listRowRows,
	updateRowResource,
} from "./resources/rows";
import {
	createServiceResource,
	listServiceRows,
	updateServiceResource,
} from "./resources/service";
import {
	createProviderResource,
	listProviderRows,
	updateProviderResource,
} from "./resources/serviceProvider";
import {
	createServiceResourceRow,
	listServiceResourceRows,
	updateServiceResourceRow,
} from "./resources/serviceResource";

type BroadcastFn = (eventName: string, payload: unknown) => void;

const evyCoreResourceNames: ReadonlySet<string> = EVY_CORE_RESOURCE_NAME_SET;

let coreBroadcast: BroadcastFn | null = null;

export function initCoreNotifications(broadcastFn: BroadcastFn | null): void {
	coreBroadcast = broadcastFn;
}

export function validateAuth(
	db: EvyDb,
	token: string,
	os: OS,
): ReturnType<typeof validateDeviceAuth> {
	return validateDeviceAuth(db, token, os);
}

export async function get(db: EvyDb, params: GetRequest): Promise<GetResponse> {
	assertEvyCoreAccess(params);
	return getCoreBody(db, params);
}

export async function listExternalServiceResources(
	db: EvyDb,
): Promise<Array<{ serviceId: string; resourceId: string }>> {
	const rows = await db
		.select({
			serviceId: service.id,
			resourceId: serviceResource.id,
		})
		.from(serviceResource)
		.innerJoin(service, eq(serviceResource.fkServiceId, service.id))
		.where(ne(service.id, EVY_CORE_SERVICE))
		.orderBy(asc(service.id), asc(serviceResource.id));

	return rows;
}

export async function listExternalServices(
	db: EvyDb,
): Promise<Array<{ id: string; name: string }>> {
	return db
		.select({ id: service.id, name: service.name })
		.from(service)
		.where(ne(service.id, EVY_CORE_SERVICE));
}

export async function create(
	db: EvyDb,
	params: CreateRequest,
): Promise<CreateResponse> {
	assertEvyCoreAccess(params);
	return createCoreBody(db, params);
}

export async function update(
	db: EvyDb,
	params: UpdateRequest,
): Promise<UpdateResponse> {
	assertEvyCoreAccess(params);
	return updateCoreBody(db, params);
}

export async function deleteResource(
	db: EvyDb,
	params: DeleteRequest,
): Promise<DeleteResponse> {
	assertEvyCoreAccess(params);
	return deleteCoreBody(db, params);
}

async function getCoreBody(
	db: EvyDb,
	params: GetRequest,
): Promise<GetResponse> {
	const { resource, filter } = params;

	if (resource === EVY_CORE_RESOURCE.FLOWS) {
		return listFlowRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.PAGES) {
		return listPageRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.ROWS) {
		return listRowRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return listServiceRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return listOrganizationRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return listProviderRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICE_RESOURCES) {
		return listServiceResourceRows(db, filter);
	}

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return listFileRowsWithBinary(db, filter);
	}

	throw new Error("Unsupported resource for core API");
}

async function createCoreBody(
	db: EvyDb,
	params: CreateRequest,
): Promise<CreateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();
	const emitNotification = buildEmitNotification(resource, "create");

	if (resource === EVY_CORE_RESOURCE.FLOWS) {
		return createFlowResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PAGES) {
		return createPageResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ROWS) {
		return createRowResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return createServiceResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return createOrganizationResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return createProviderResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICE_RESOURCES) {
		return createServiceResourceRow(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return createFileResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	throw new Error("Create is not supported for this resource");
}

async function updateCoreBody(
	db: EvyDb,
	params: UpdateRequest,
): Promise<UpdateResponse> {
	const { resource, filter, data: dataPayload } = params;
	const nowIso = new Date().toISOString();
	const emitNotification = buildEmitNotification(resource, "update");

	if (resource === EVY_CORE_RESOURCE.FLOWS) {
		return updateFlowResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PAGES) {
		return updatePageResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ROWS) {
		return updateRowResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return updateServiceResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return updateOrganizationResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return updateProviderResource(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICE_RESOURCES) {
		return updateServiceResourceRow(
			db,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	throw new Error("Update is not supported for this resource");
}

async function deleteCoreBody(
	db: EvyDb,
	params: DeleteRequest,
): Promise<DeleteResponse> {
	const { resource, filter } = params;
	const emitNotification = buildEmitNotification(resource, "delete");

	if (resource === EVY_CORE_RESOURCE.FLOWS) {
		return deleteFlowResource(db, filter, emitNotification);
	}

	if (resource === EVY_CORE_RESOURCE.PAGES) {
		return deletePageResource(db, filter, emitNotification);
	}

	if (resource === EVY_CORE_RESOURCE.ROWS) {
		return deleteRowResource(db, filter, emitNotification);
	}

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return deleteFileResource(db, filter, emitNotification);
	}

	throw new Error("Delete is not supported for this resource");
}

function assertEvyCoreAccess(
	params: GetRequest | CreateRequest | UpdateRequest | DeleteRequest,
): void {
	if (params.service !== EVY_CORE_SERVICE) {
		throw new Error("Core API only serves service evy");
	}
	if (!evyCoreResourceNames.has(params.resource)) {
		throw new Error("Resource is not served by the core API");
	}
}

function buildEmitNotification(
	resource: string,
	operation: "create" | "update" | "delete",
) {
	return (value: unknown) => {
		coreBroadcast?.(DATA_CHANGED_EVENT, {
			service: EVY_CORE_SERVICE,
			resource,
			operation,
			value,
		});
	};
}
