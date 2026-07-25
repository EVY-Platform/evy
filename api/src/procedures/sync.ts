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

type ExternalServiceResource = {
	serviceId: string;
	resourceId: string;
};

type SyncError = NonNullable<SyncResponse["errors"]>[number];

type FetchOutcome = { rows: SyncRow[]; errors: SyncError[] };

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function fetchEvyCoreData(
	lastSyncTime: string,
	getCore: (params: GetRequest) => Promise<GetResponse>,
): Promise<FetchOutcome> {
	const rows: SyncRow[] = [];
	const errors: SyncError[] = [];
	for (const coreResourceName of EVY_CORE_RESOURCE_NAMES) {
		if (coreResourceName === EVY_CORE_RESOURCE.DEVICES) continue;

		try {
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
		} catch (error) {
			errors.push({
				service: EVY_CORE_SERVICE,
				resource: coreResourceName,
				message: describe(error),
			});
		}
	}
	return { rows, errors };
}

async function fetchExternalServiceData(
	lastSyncTime: string,
	externalResources: ExternalServiceResource[],
	fetchService: typeof services.forwardGet,
): Promise<FetchOutcome> {
	const rows: SyncRow[] = [];
	const errors: SyncError[] = [];
	for (const { serviceId, resourceId } of externalResources) {
		try {
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
		} catch (error) {
			// One unreachable service degrades the response instead of failing
			// the whole sync for every other resource.
			errors.push({
				service: serviceId,
				resource: resourceId,
				message: describe(error),
			});
		}
	}
	return { rows, errors };
}

export async function sync(
	syncParams: SyncRequest,
	db: EvyDb,
): Promise<SyncResponse> {
	const externalResources = await data.listExternalServiceResources(db);
	const resumedFrom = resumePoint(syncParams);

	const [evyData, externalData] = await Promise.all([
		fetchEvyCoreData(resumedFrom, (request) => data.get(db, request)),
		fetchExternalServiceData(
			resumedFrom,
			externalResources,
			services.forwardGet,
		),
	]);

	const rows = [...evyData.rows, ...externalData.rows];
	const errors = [...evyData.errors, ...externalData.errors];

	// A partial response must not advance the cursor, or the resources that
	// failed would never be retried.
	const cursor =
		errors.length > 0 ? resumedFrom : nextCursor(rows, resumedFrom);

	return validateSyncResponse({
		data: rows,
		cursor,
		...(errors.length > 0 ? { errors } : {}),
	});
}
