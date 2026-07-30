import type {
	GetRequest,
	GetResponse,
	ResourcesResponse,
	SyncRequest,
	SyncResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { serviceOfRef } from "evy-types/resourceRef";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import { discoverResources } from "./resources";
import * as services from "./services";

type SyncRow = SyncResponse["data"][number];

const EPOCH = "1970-01-01T00:00:00.000Z";
const RESOURCE_CATALOG_KEY = EVY_CORE_RESOURCE_REF.RESOURCES;

function resumePoint(syncParams: SyncRequest): string {
	return syncParams.cursor ?? EPOCH;
}

function nextCursor(rows: SyncRow[], resumedFrom: string): string {
	let highWater = resumedFrom;
	for (const row of rows) {
		if (!Array.isArray(row.value)) continue;
		for (const record of row.value) {
			if (!record || typeof record !== "object") continue;
			const updated_at = (record as Record<string, unknown>).updated_at;
			if (typeof updated_at === "string" && updated_at > highWater) {
				highWater = updated_at;
			}
		}
	}
	return highWater;
}

type SyncError = NonNullable<SyncResponse["errors"]>[number];

type FetchOutcome = { rows: SyncRow[]; errors: SyncError[] };

type ResourceRef = string;

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
				resource: ref,
				filter: { updated_after: since },
			});
			if (value.length === 0) continue;
			rows.push({ resource: ref, value });
		} catch (error) {
			errors.push({ resource: ref, message: describe(error) });
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
		return service.resources.map((resource) => resource.id);
	});
}

function coreResourceRefs(): ResourceRef[] {
	return Object.values(EVY_CORE_RESOURCE_REF).filter(
		(ref) =>
			ref !== EVY_CORE_RESOURCE_REF.DEVICES &&
			ref !== EVY_CORE_RESOURCE_REF.RESOURCES,
	);
}

function discoveryErrorsToSyncErrors(
	errors: NonNullable<
		Awaited<ReturnType<typeof discoverResources>>["errors"]
	>,
): SyncError[] {
	return errors.map((error) => ({
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
	const owned = syncParams.owned_resources ?? [];

	const [core, external] = await Promise.all([
		fetchResources(coreResourceRefs(), resumedFrom, (ref) =>
			data.getSyncRows(db, ref, {
				updated_after: resumedFrom,
				owned,
			}),
		),
		fetchResources(externalRefs, resumedFrom, (ref, request) =>
			services.forwardGet(serviceOfRef(ref), request),
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
