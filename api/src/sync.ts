import type { GetRequest, GetResponse, SyncResponse } from "evy-types";
import {
	getServiceNames,
	getServiceResources,
} from "evy-types/rpcRequestHelpers";
import { validateSync, validateSyncResponse } from "evy-types/validators";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { getCoreForValidatedRequest } from "./data";
import { ensureRegistryInitialized, forwardGet } from "./services";
import { buildResourceRegistry } from "./resources";

type SyncRow = SyncResponse["data"][number];

/**
 * Fetch all evy-core resources that have changed since lastSyncTime.
 * Skips "devices" (auth-only) and resources that returned no changes.
 */
async function fetchEvyCoreData(
	lastSyncTime: string,
	getCore: typeof getCoreForValidatedRequest,
): Promise<SyncRow[]> {
	const rows: SyncRow[] = [];
	const evyResources = getServiceResources(EVY_CORE_SERVICE) ?? [];

	for (const resource of evyResources) {
		if (resource === "devices") {
			continue;
		}

		const request: GetRequest = {
			service: EVY_CORE_SERVICE,
			resource,
			filter: { updatedAfter: lastSyncTime },
		};

		const value: GetResponse = await getCore(request);

		if (Array.isArray(value) && value.length === 0) {
			continue;
		}

		rows.push({
			service: EVY_CORE_SERVICE,
			resource,
			value,
		});
	}

	return rows;
}

/**
 * Fetch all external-service resources that have changed since lastSyncTime.
 */
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

			if (Array.isArray(value) && value.length === 0) {
				continue;
			}

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
	getCore: typeof getCoreForValidatedRequest;
	fetchService: typeof forwardGet;
	buildRegistry: typeof buildResourceRegistry;
};

const DEFAULT_DEPS: SyncDependencies = {
	getCore: getCoreForValidatedRequest,
	fetchService: forwardGet,
	buildRegistry: buildResourceRegistry,
};

/**
 * Unified sync JSON-RPC handler.
 *
 * Accepts a `lastSyncTime` ISO string and returns:
 * - `resources`: the full resource registry (so clients don't need a separate call)
 * - `data`: all rows (SDUI, evy catalog, and external service data) that were
 *   updated since `lastSyncTime`, shaped as `{ service, resource, value }[]`
 *
 * Only includes `resources` when data changed.
 */
export async function sync(
	params: unknown,
	deps: SyncDependencies = DEFAULT_DEPS,
): Promise<SyncResponse> {
	validateSync(params);

	await ensureRegistryInitialized();

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
