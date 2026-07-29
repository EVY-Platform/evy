import type {
	GetRequest,
	GetResponse,
	ResourcesResponse,
	SyncRequest,
	SyncResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE,
	EVY_CORE_RESOURCE_NAMES,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import { discoverResources } from "./resources";
import * as services from "./services";

type SyncRow = SyncResponse["data"][number];

const EPOCH = "1970-01-01T00:00:00.000Z";
const RESOURCE_CATALOG_KEY = EVY_CORE_RESOURCE.RESOURCES;

function resumePoint(syncParams: SyncRequest): string {
	return syncParams.cursor ?? EPOCH;
}

function nextCursor(rows: SyncRow[], resumedFrom: string): string {
	let highWater = resumedFrom;
	for (const row of rows) {
		if (!Array.isArray(row.value)) continue;
		for (const record of row.value) {
			if (!record || typeof record !== "object") continue;
			const updatedAt = (record as Record<string, unknown>).updatedAt;
			if (typeof updatedAt === "string" && updatedAt > highWater) {
				highWater = updatedAt;
			}
		}
	}
	return highWater;
}

type SyncError = NonNullable<SyncResponse["errors"]>[number];

type FetchOutcome = { rows: SyncRow[]; errors: SyncError[] };

/** A resource to pull from, and the service that owns it. */
type ResourceRef = { service: string; resource: string };

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function fetchResources(
	refs: ResourceRef[],
	since: string,
	fetchOne: (ref: ResourceRef, request: GetRequest) => Promise<GetResponse>,
): Promise<FetchOutcome> {
	const rows: SyncRow[] = [];
	const errors: SyncError[] = [];

	for (const ref of refs) {
		try {
			const value = await fetchOne(ref, {
				service: ref.service,
				resource: ref.resource,
				filter: { updatedAfter: since },
			});
			if (value.length === 0) continue;
			rows.push({ ...ref, value });
		} catch (error) {
			errors.push({ ...ref, message: describe(error) });
		}
	}

	return { rows, errors };
}

function externalResourceRefs(
	response: ResourcesResponse,
	coreServiceId: string,
): ResourceRef[] {
	return response.services.flatMap((service) => {
		if (service.id === coreServiceId) return [];
		return service.resources.map((resource) => ({
			service: service.id,
			resource: resource.id,
		}));
	});
}

function coreResourceRefs(): ResourceRef[] {
	return EVY_CORE_RESOURCE_NAMES.filter(
		(name) =>
			name !== EVY_CORE_RESOURCE.DEVICES &&
			name !== EVY_CORE_RESOURCE.RESOURCES,
	).map((resource) => ({ service: EVY_CORE_SERVICE, resource }));
}

function discoveryErrorsToSyncErrors(
	errors: NonNullable<
		Awaited<ReturnType<typeof discoverResources>>["errors"]
	>,
): SyncError[] {
	return errors.map((error) => ({
		service: error.service,
		resource: RESOURCE_CATALOG_KEY,
		message: error.message,
	}));
}

export async function sync(
	syncParams: SyncRequest,
	db: EvyDb,
): Promise<SyncResponse> {
	const catalog = await discoverResources(db);
	const discoveryComplete = !catalog.errors || catalog.errors.length === 0;
	const externalRefs = externalResourceRefs(catalog, EVY_CORE_SERVICE);

	const resumedFrom = resumePoint(syncParams);
	const owned = syncParams.ownedServiceResources ?? [];

	const [core, external] = await Promise.all([
		fetchResources(coreResourceRefs(), resumedFrom, (ref) =>
			data.getSyncRows(db, ref.resource, {
				updatedAfter: resumedFrom,
				owned,
			}),
		),
		fetchResources(externalRefs, resumedFrom, (ref, request) =>
			services.forwardGet(ref.service, request),
		),
	]);

	const rows = [...core.rows, ...external.rows];
	const errors = [
		...discoveryErrorsToSyncErrors(catalog.errors ?? []),
		...core.errors,
		...external.errors,
	];

	if (discoveryComplete) {
		rows.push({
			service: EVY_CORE_SERVICE,
			resource: RESOURCE_CATALOG_KEY,
			value: catalog,
		});
	}

	// Partial responses must not advance the cursor
	const cursor =
		errors.length > 0 ? resumedFrom : nextCursor(rows, resumedFrom);

	return {
		data: rows,
		cursor,
		...(errors.length > 0 ? { errors } : {}),
	};
}
