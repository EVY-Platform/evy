import type {
	GetRequest,
	GetResponse,
	SyncRequest,
	SyncResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAMES,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { validateSyncResponse } from "evy-types/validators";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import * as services from "./services";

type SyncRow = SyncResponse["data"][number];

type ExternalServiceResource = {
	serviceId: string;
	resourceId: string;
};

async function fetchEvyCoreData(
	lastSyncTime: string,
	getCore: (params: GetRequest) => Promise<GetResponse>,
): Promise<SyncRow[]> {
	const rows: SyncRow[] = [];
	for (const coreResourceName of EVY_CORE_RESOURCE_NAMES) {
		if (coreResourceName === EVY_CORE_RESOURCE.DEVICES) continue;

		const value: GetResponse = await getCore({
			service: EVY_CORE_SERVICE,
			resource: coreResourceName,
			filter: { updatedAfter: lastSyncTime },
		});
		if (value.length === 0) continue;

		rows.push({
			service: EVY_CORE_SERVICE,
			resource: coreResourceName,
			value,
		});
	}
	return rows;
}

async function fetchExternalServiceData(
	lastSyncTime: string,
	externalResources: ExternalServiceResource[],
	fetchService: typeof services.forwardGet,
): Promise<SyncRow[]> {
	const rows: SyncRow[] = [];
	for (const { serviceId, resourceId } of externalResources) {
		const value: GetResponse = await fetchService(serviceId, {
			service: serviceId,
			resource: resourceId,
			filter: { updatedAfter: lastSyncTime },
		});

		if (value.length === 0) continue;

		rows.push({
			service: serviceId,
			resource: resourceId,
			value,
		});
	}
	return rows;
}

export async function sync(
	syncParams: SyncRequest,
	db: EvyDb,
): Promise<SyncResponse> {
	const externalResources = await data.listExternalServiceResources(db);

	const [evyData, externalData] = await Promise.all([
		fetchEvyCoreData(syncParams.lastSyncTime, (request) =>
			data.get(db, request),
		),
		fetchExternalServiceData(
			syncParams.lastSyncTime,
			externalResources,
			services.forwardGet,
		),
	]);

	return validateSyncResponse({ data: [...evyData, ...externalData] });
}
