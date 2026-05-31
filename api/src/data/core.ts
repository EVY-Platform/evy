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
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAME_SET,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { emitDataChangedNotification } from "../notifications";

import {
	service,
	organization,
	serviceProvider,
} from "../../../types/generated/ts/db/schema.generated";

import {
	listCoreResourceRows,
	insertResourceEntityFromConfig,
	updateResourceEntityFromConfig,
	mapServiceRow,
	serviceResourceConfig,
	organizationResourceConfig,
	providerResourceConfig,
} from "./resources";
import { getSduiRows, createSduiFlow, updateSduiFlow } from "./sdui";
import {
	createFileResource,
	deleteFileResource,
	listFileRowsWithBinary,
} from "./files";

const evyCoreResourceNameSet: ReadonlySet<string> = EVY_CORE_RESOURCE_NAME_SET;

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
export { deleteResource as delete };

async function getCoreBody(params: GetRequest): Promise<GetResponse> {
	const { resource, filter } = params;

	if (resource === EVY_CORE_RESOURCE.SDUI) {
		return getSduiRows(filter);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return listCoreResourceRows(service, filter, mapServiceRow);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return listCoreResourceRows(organization, filter, (r) => r);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return listCoreResourceRows(serviceProvider, filter, (r) => r);
	}

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return listFileRowsWithBinary(filter);
	}

	throw new Error("Unsupported resource for core API");
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
		return createSduiFlow(filter, dataPayload, nowIso, emitNotification);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return insertResourceEntityFromConfig(
			serviceResourceConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return insertResourceEntityFromConfig(
			organizationResourceConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return insertResourceEntityFromConfig(
			providerResourceConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return createFileResource(filter, dataPayload, nowIso, emitNotification);
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
		return updateSduiFlow(filter, dataPayload, nowIso, emitNotification);
	}

	if (resource === EVY_CORE_RESOURCE.SERVICES) {
		return updateResourceEntityFromConfig(
			serviceResourceConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.ORGANISATIONS) {
		return updateResourceEntityFromConfig(
			organizationResourceConfig,
			filter,
			dataPayload,
			nowIso,
			emitNotification,
		);
	}

	if (resource === EVY_CORE_RESOURCE.PROVIDERS) {
		return updateResourceEntityFromConfig(
			providerResourceConfig,
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

	if (resource === EVY_CORE_RESOURCE.FILES) {
		return deleteFileResource(filter, emitNotification);
	}

	throw new Error("Delete is not supported for this resource");
}
