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
import type { EvyDb } from "../database/db";

import { validateAuth as validateDeviceAuth } from "./resources/devices";
import {
	createFileResource,
	deleteFileResource,
	listFileRowsWithBinary,
} from "./resources/files";
import {
	createOrganizationResource,
	listOrganizationRows,
	updateOrganizationResource,
} from "./resources/organisation";
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
import { createSduiFlow, getSduiRows, updateSduiFlow } from "./resources/sdui";

// Types

type BroadcastFn = (eventName: string, payload: unknown) => void;

// Constants and state

const DATA_CHANGED_EVENT = "dataChanged";
const evyCoreResourceNameSet: ReadonlySet<string> = EVY_CORE_RESOURCE_NAME_SET;

let coreBroadcast: BroadcastFn | null = null;

// Public API

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

// Core request dispatch

async function getCoreBody(
	db: EvyDb,
	params: GetRequest,
): Promise<GetResponse> {
	const { resource, filter } = params;

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		return getSduiRows(db, filter);
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

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		return createSduiFlow(db, filter, dataPayload, nowIso, emitNotification);
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

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		return updateSduiFlow(db, filter, dataPayload, nowIso, emitNotification);
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

	throw new Error("Update is not supported for this resource");
}

async function deleteCoreBody(
	db: EvyDb,
	params: DeleteRequest,
): Promise<DeleteResponse> {
	const { resource, filter } = params;
	const emitNotification = buildEmitNotification(resource, "delete");

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return deleteFileResource(db, filter, emitNotification);
	}

	throw new Error("Delete is not supported for this resource");
}

// Local helpers

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
