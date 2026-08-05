import { ne } from "drizzle-orm";
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
import { nowIso as clockNowIso } from "evy-types/clock";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { service } from "evy-types/db/schema.generated";
import { serviceOfRef } from "evy-types/resourceRef";
import {
	DATA_CHANGED_EVENT,
	type DataChangedNotification,
	type DataChangedOperation,
} from "evy-types/ws";
import type { EvyDb } from "../database/db";
import { addressesResource } from "./resources/addresses";
import type { SyncScope, SyncScopeInput } from "./resources/coreResource";
import {
	createFileResource,
	deleteFileResource,
	listFileRows,
	listFilesForSync,
} from "./resources/files";
import { flowsResource } from "./resources/flows";
import { formattersResource } from "./resources/formatters";
import { messagesResource } from "./resources/messages";
import { organizationsResource } from "./resources/organization";
import { pagesResource } from "./resources/pages";
import { rowsResource } from "./resources/rows";
import { servicesResource } from "./resources/service";
import { providersResource } from "./resources/serviceProvider";
import { transactionsResource } from "./resources/transactions";

type BroadcastFn = (eventName: string, payload: unknown) => void;

type CoreResourceOps = {
	list: (
		db: EvyDb,
		filter: GetRequest["filter"] | undefined,
	) => Promise<GetResponse>;
	listForSync: (db: EvyDb, scope: SyncScope) => Promise<GetResponse>;
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

// Resources that support all CRUD ops register the factory object
// directly; the rest pick fields explicitly so the omitted operations
// stay unreachable through the RPC dispatch.
const CORE_RESOURCE_REGISTRY: Record<string, CoreResourceOps> = {
	[EVY_CORE_RESOURCE_REF.FLOWS]: flowsResource,
	[EVY_CORE_RESOURCE_REF.PAGES]: pagesResource,
	[EVY_CORE_RESOURCE_REF.ROWS]: rowsResource,
	[EVY_CORE_RESOURCE_REF.ADDRESSES]: addressesResource,
	[EVY_CORE_RESOURCE_REF.FORMATTERS]: formattersResource,
	[EVY_CORE_RESOURCE_REF.MESSAGES]: messagesResource,
	[EVY_CORE_RESOURCE_REF.TRANSACTIONS]: transactionsResource,
	[EVY_CORE_RESOURCE_REF.SERVICES]: {
		list: servicesResource.list,
		listForSync: servicesResource.listForSync,
		create: servicesResource.create,
		update: servicesResource.update,
	},
	[EVY_CORE_RESOURCE_REF.ORGANIZATIONS]: {
		list: organizationsResource.list,
		listForSync: organizationsResource.listForSync,
		create: organizationsResource.create,
		update: organizationsResource.update,
	},
	[EVY_CORE_RESOURCE_REF.PROVIDERS]: {
		list: providersResource.list,
		listForSync: providersResource.listForSync,
		create: providersResource.create,
		update: providersResource.update,
	},
	[EVY_CORE_RESOURCE_REF.FILES]: {
		list: listFileRows,
		listForSync: listFilesForSync,
		create: createFileResource,
		remove: deleteFileResource,
	},
};

let coreBroadcast: BroadcastFn | null = null;

export function initCoreNotifications(broadcastFn: BroadcastFn | null): void {
	coreBroadcast = broadcastFn;
}

export { validateAuth } from "./resources/devices";

export async function get(db: EvyDb, params: GetRequest): Promise<GetResponse> {
	assertEvyCoreAccess(params);
	return getCoreBody(db, params);
}

export async function getSyncRows(
	db: EvyDb,
	resource: string,
	scope: SyncScopeInput,
): Promise<GetResponse> {
	return getResourceOps(resource).listForSync(db, { ...scope, resource });
}

type ExternalServiceRow = {
	id: string;
	name: string;
	ws_host: string | null;
	ws_port: number | null;
};

export async function listExternalServices(
	db: EvyDb,
): Promise<ExternalServiceRow[]> {
	return db
		.select({
			id: service.id,
			name: service.name,
			ws_host: service.ws_host,
			ws_port: service.ws_port,
		})
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
	if (!ops) throw new Error("Resource is not served by the core API");
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
	const nowIso = clockNowIso();
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
	const nowIso = clockNowIso();
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
	if (serviceOfRef(params.resource) !== EVY_CORE_SERVICE) {
		throw new Error("Core API only serves service evy");
	}
}

function buildEmitNotification(
	resource: string,
	operation: DataChangedOperation,
) {
	return (value: unknown) => {
		const notification: DataChangedNotification = {
			resource,
			operation,
			value,
		};
		coreBroadcast?.(DATA_CHANGED_EVENT, notification);
	};
}
