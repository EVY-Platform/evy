import { asc, eq, ne } from "drizzle-orm";
import type {
	CreateRequest,
	CreateResponse,
	DeleteRequest,
	DeleteResponse,
	GetRequest,
	GetResponse,
	UpdateRequest,
	UpdateResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAME_SET,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import {
	DATA_CHANGED_EVENT,
	type DataChangedNotification,
	type DataChangedOperation,
} from "evy-types/ws";
import {
	service,
	serviceResource,
} from "../../../types/generated/ts/db/schema.generated";
import type { EvyDb } from "../database/db";

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

type CoreResourceOps = {
	list: (
		db: EvyDb,
		filter: GetRequest["filter"] | undefined,
	) => Promise<GetResponse>;
	create?: (
		db: EvyDb,
		filter: CreateRequest["filter"] | undefined,
		dataPayload: unknown,
		nowIso: string,
		notify: (value: unknown) => void,
	) => Promise<CreateResponse>;
	update?: (
		db: EvyDb,
		filter: UpdateRequest["filter"],
		dataPayload: unknown,
		nowIso: string,
		notify: (value: unknown) => void,
	) => Promise<UpdateResponse>;
	remove?: (
		db: EvyDb,
		filter: DeleteRequest["filter"],
		notify: (value: unknown) => void,
	) => Promise<DeleteResponse>;
};

const CORE_RESOURCE_REGISTRY: Record<string, CoreResourceOps> = {
	[EVY_CORE_RESOURCE.FLOWS]: {
		list: listFlowRows,
		create: createFlowResource,
		update: updateFlowResource,
		remove: deleteFlowResource,
	},
	[EVY_CORE_RESOURCE.PAGES]: {
		list: listPageRows,
		create: createPageResource,
		update: updatePageResource,
		remove: deletePageResource,
	},
	[EVY_CORE_RESOURCE.ROWS]: {
		list: listRowRows,
		create: createRowResource,
		update: updateRowResource,
		remove: deleteRowResource,
	},
	[EVY_CORE_RESOURCE.SERVICES]: {
		list: listServiceRows,
		create: createServiceResource,
		update: updateServiceResource,
	},
	[EVY_CORE_RESOURCE.ORGANISATIONS]: {
		list: listOrganizationRows,
		create: createOrganizationResource,
		update: updateOrganizationResource,
	},
	[EVY_CORE_RESOURCE.PROVIDERS]: {
		list: listProviderRows,
		create: createProviderResource,
		update: updateProviderResource,
	},
	[EVY_CORE_RESOURCE.SERVICE_RESOURCES]: {
		list: listServiceResourceRows,
		create: createServiceResourceRow,
		update: updateServiceResourceRow,
	},
	[EVY_CORE_RESOURCE.FILES]: {
		list: listFileRowsWithBinary,
		create: createFileResource,
		remove: deleteFileResource,
	},
};

let coreBroadcast: BroadcastFn | null = null;

export function initCoreNotifications(broadcastFn: BroadcastFn | null): void {
	coreBroadcast = broadcastFn;
}

export function validateAuth(
	db: EvyDb,
	token: string,
	os: import("evy-types").OS,
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
	return db
		.select({
			serviceId: service.id,
			resourceId: serviceResource.id,
		})
		.from(serviceResource)
		.innerJoin(service, eq(serviceResource.fkServiceId, service.id))
		.where(ne(service.id, EVY_CORE_SERVICE))
		.orderBy(asc(service.id), asc(serviceResource.id));
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

function getResourceOps(resource: string): CoreResourceOps {
	const ops = CORE_RESOURCE_REGISTRY[resource];
	if (!ops) throw new Error("Unsupported resource for core API");
	return ops;
}

async function getCoreBody(
	db: EvyDb,
	params: GetRequest,
): Promise<GetResponse> {
	const ops = getResourceOps(params.resource);
	return ops.list(db, params.filter);
}

async function createCoreBody(
	db: EvyDb,
	params: CreateRequest,
): Promise<CreateResponse> {
	const ops = getResourceOps(params.resource);
	if (!ops.create) {
		throw new Error("Create is not supported for this resource");
	}
	const nowIso = new Date().toISOString();
	const emitNotification = buildEmitNotification(params.resource, "create");
	return ops.create(db, params.filter, params.data, nowIso, emitNotification);
}

async function updateCoreBody(
	db: EvyDb,
	params: UpdateRequest,
): Promise<UpdateResponse> {
	const ops = getResourceOps(params.resource);
	if (!ops.update) {
		throw new Error("Update is not supported for this resource");
	}
	const nowIso = new Date().toISOString();
	const emitNotification = buildEmitNotification(params.resource, "update");
	return ops.update(db, params.filter, params.data, nowIso, emitNotification);
}

async function deleteCoreBody(
	db: EvyDb,
	params: DeleteRequest,
): Promise<DeleteResponse> {
	const ops = getResourceOps(params.resource);
	if (!ops.remove) {
		throw new Error("Delete is not supported for this resource");
	}
	const emitNotification = buildEmitNotification(params.resource, "delete");
	return ops.remove(db, params.filter, emitNotification);
}

function assertEvyCoreAccess(
	params: GetRequest | CreateRequest | UpdateRequest | DeleteRequest,
): void {
	if (params.service !== EVY_CORE_SERVICE) {
		throw new Error("Core API only serves service evy");
	}
	if (!EVY_CORE_RESOURCE_NAME_SET.has(params.resource)) {
		throw new Error("Resource is not served by the core API");
	}
}

function buildEmitNotification(
	resource: string,
	operation: DataChangedOperation,
) {
	return (value: unknown) => {
		const notification: DataChangedNotification = {
			service: EVY_CORE_SERVICE,
			resource,
			operation,
			value,
		};
		coreBroadcast?.(DATA_CHANGED_EVENT, notification);
	};
}
