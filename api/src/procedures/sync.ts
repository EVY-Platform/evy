import type { GetRequest, GetResponse, SyncResponse } from "evy-types";
import {
	getServiceNames,
	getServiceResources,
} from "evy-types/rpcRequestHelpers";
import { validateSync, validateSyncResponse } from "evy-types/validators";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { createDb as createAppDb } from "../database/db";
import { get as defaultGetCore } from "../data/data";
import { forwardGet } from "./services";
import { buildResourceRegistry } from "./resources";

const appDb = createAppDb();

type SyncRow = SyncResponse["data"][number];

async function fetchEvyCoreData(
	lastSyncTime: string,
	getCore: typeof defaultGetCore,
): Promise<SyncRow[]> {
	const rows: SyncRow[] = [];
	const evyResources = getServiceResources(EVY_CORE_SERVICE) ?? [];

	for (const resource of evyResources) {
		if (resource === "devices") continue;

		const request: GetRequest = {
			service: EVY_CORE_SERVICE,
			resource,
			filter: { updatedAfter: lastSyncTime },
		};

		const value: GetResponse = await getCore(request);
		if (value.length === 0) continue;

		rows.push({
			service: EVY_CORE_SERVICE,
			resource,
			value,
		});
	}

	return rows;
}

async function fetchExternalServiceData(
	lastSyncTime: string,
	fetchService: typeof forwardGet,
): Promise<SyncRow[]> {
	const rows: SyncRow[] = [];
	const serviceNames = getServiceNames().filter(
		(name) => name !== EVY_CORE_SERVICE,
	);

	for (const serviceName of serviceNames) {
		const resources = getServiceResources(serviceName) ?? [];

		for (const resource of resources) {
			const request: GetRequest = {
				service: serviceName,
				resource,
				filter: { updatedAfter: lastSyncTime },
			};

			const value: GetResponse = await fetchService(serviceName, request);

			if (value.length === 0) continue;

			rows.push({
				service: serviceName,
				resource,
				value,
			});
		}
	}

	return rows;
}

type SyncDependencies = {
	getCore: typeof defaultGetCore;
	fetchService: typeof forwardGet;
	buildRegistry: typeof buildResourceRegistry;
};

const DEFAULT_DEPS: SyncDependencies = {
	getCore: (params) => defaultGetCore(appDb, params),
	fetchService: forwardGet,
	buildRegistry: buildResourceRegistry,
};

// resources is only included in the response when data changed.
export async function sync(
	params: unknown,
	deps: SyncDependencies = DEFAULT_DEPS,
): Promise<SyncResponse> {
	validateSync(params);

	const [evyData, externalData] = await Promise.all([
		fetchEvyCoreData(params.lastSyncTime, deps.getCore),
		fetchExternalServiceData(params.lastSyncTime, deps.fetchService),
	]);

	const data = [...evyData, ...externalData];

	if (data.length === 0) {
		return validateSyncResponse({ data });
	}

	const resources = deps.buildRegistry();
	return validateSyncResponse({ data, resources });
}
