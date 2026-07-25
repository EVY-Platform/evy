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
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import * as services from "./services";

type SyncRow = SyncResponse["data"][number];

const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Where to resume from. The cursor is preferred; lastSyncTime is accepted so
 * clients predating it keep working, and neither means a full sync.
 */
function resumePoint(syncParams: SyncRequest): string {
	return syncParams.cursor ?? syncParams.lastSyncTime ?? EPOCH;
}

/**
 * The high-water mark actually observed in this response, so the next sync
 * resumes from server-recorded time rather than the client's clock. Falls back
 * to where we resumed from when nothing changed, which keeps the cursor stable
 * instead of drifting forward past unseen writes.
 */
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

/**
 * Pulls everything changed since `since` for each resource.
 *
 * One resource failing degrades the response rather than failing the sync for
 * every other resource, so each is caught and reported on its own.
 */
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

/** Devices are written by the client and never synced back to it. */
function coreResourceRefs(): ResourceRef[] {
	return EVY_CORE_RESOURCE_NAMES.filter(
		(name) => name !== EVY_CORE_RESOURCE.DEVICES,
	).map((resource) => ({ service: EVY_CORE_SERVICE, resource }));
}

export async function sync(
	syncParams: SyncRequest,
	db: EvyDb,
): Promise<SyncResponse> {
	const externalResources = await data.listExternalServiceResources(db);

	const resumedFrom = resumePoint(syncParams);

	const [core, external] = await Promise.all([
		fetchResources(coreResourceRefs(), resumedFrom, (_ref, request) =>
			data.get(db, request),
		),
		fetchResources(
			externalResources.map(({ serviceId, resourceId }) => ({
				service: serviceId,
				resource: resourceId,
			})),
			resumedFrom,
			(ref, request) => services.forwardGet(ref.service, request),
		),
	]);

	const rows = [...core.rows, ...external.rows];
	const errors = [...core.errors, ...external.errors];

	// A partial response must not advance the cursor, or the resources that
	// failed would never be retried.
	const cursor =
		errors.length > 0 ? resumedFrom : nextCursor(rows, resumedFrom);

	return {
		data: rows,
		cursor,
		...(errors.length > 0 ? { errors } : {}),
	};
}
