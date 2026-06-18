import type { GetRequest, GetResponse, SyncResponse } from "evy-types";
import { asc, eq, ne } from "drizzle-orm";
import { validateSync, validateSyncResponse } from "evy-types/validators";
import {
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAMES,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import type { EvyDb } from "../database/db";
import { get as defaultGetCore } from "../data/data";
import { forwardGet } from "./services";
import {
	service,
	serviceResource,
} from "../../../types/generated/ts/db/schema.generated";

type SyncRow = SyncResponse["data"][number];

type ExternalServiceResource = {
	serviceId: string;
	resourceId: string;
};

type SyncDependencies = {
	getCore: (params: GetRequest) => Promise<GetResponse>;
	fetchService: typeof forwardGet;
	listExternalResources: (db: EvyDb) => Promise<ExternalServiceResource[]>;
};

async function defaultListExternalResources(
	db: EvyDb,
): Promise<ExternalServiceResource[]> {
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
	fetchService: typeof forwardGet,
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

function defaultSyncDeps(db: EvyDb): SyncDependencies {
	return {
		getCore: (request) => defaultGetCore(db, request),
		fetchService: forwardGet,
		listExternalResources: defaultListExternalResources,
	};
}

export async function sync(
	params: unknown,
	db: EvyDb,
	deps?: SyncDependencies,
): Promise<SyncResponse> {
	const syncParams = validateSync(params);

	const resolvedDeps = deps ?? defaultSyncDeps(db);
	const externalResources = await resolvedDeps.listExternalResources(db);

	const [evyData, externalData] = await Promise.all([
		fetchEvyCoreData(syncParams.lastSyncTime, resolvedDeps.getCore),
		fetchExternalServiceData(
			syncParams.lastSyncTime,
			externalResources,
			resolvedDeps.fetchService,
		),
	]);

	return validateSyncResponse({ data: [...evyData, ...externalData] });
}
