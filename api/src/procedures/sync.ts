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
import type { OwnedMessagesParams, OwnedServiceResource } from "../data/data";
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

/**
 * Devices, the resource catalog and messages are handled outside the core fetch
 * loop. Messages are not readable wholesale: they go only to the device that
 * created them and the device that owns the record they address.
 */
function coreResourceRefs(): ResourceRef[] {
	return EVY_CORE_RESOURCE_NAMES.filter(
		(name) =>
			name !== EVY_CORE_RESOURCE.DEVICES &&
			name !== EVY_CORE_RESOURCE.RESOURCES &&
			name !== EVY_CORE_RESOURCE.MESSAGES,
	).map((resource) => ({ service: EVY_CORE_SERVICE, resource }));
}

type SplitOwnership = Omit<OwnedMessagesParams, "updatedAfter">;

/**
 * The device's own messages come from the ids it declares under the core
 * `messages` resource; everything else it owns is a record a message may be
 * addressed to.
 */
function splitOwnedServiceResources(syncParams: SyncRequest): SplitOwnership {
	const ownedMessageIds: string[] = [];
	const ownedForeignKeys: OwnedServiceResource[] = [];

	for (const group of syncParams.ownedServiceResources ?? []) {
		if (
			group.service === EVY_CORE_SERVICE &&
			group.resource === EVY_CORE_RESOURCE.MESSAGES
		) {
			ownedMessageIds.push(...group.ids);
			continue;
		}
		ownedForeignKeys.push(group);
	}

	return { ownedMessageIds, ownedForeignKeys };
}

function ownsAnything(ownership: SplitOwnership): boolean {
	return (
		ownership.ownedMessageIds.length > 0 ||
		ownership.ownedForeignKeys.length > 0
	);
}

/** The single ref the ownership-scoped messages read reports rows and errors under. */
const MESSAGES_REF: ResourceRef = {
	service: EVY_CORE_SERVICE,
	resource: EVY_CORE_RESOURCE.MESSAGES,
};

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
	const ownership = splitOwnedServiceResources(syncParams);

	const [core, external, ownedMessages] = await Promise.all([
		fetchResources(coreResourceRefs(), resumedFrom, (_ref, request) =>
			data.get(db, request),
		),
		fetchResources(externalRefs, resumedFrom, (ref, request) =>
			services.forwardGet(ref.service, request),
		),
		// Routed through the same fetch as everything else so it degrades
		// identically: a broken messages read costs the device its messages this
		// round, not the rest of the sync. A device that owns nothing reads nothing.
		fetchResources(
			ownsAnything(ownership) ? [MESSAGES_REF] : [],
			resumedFrom,
			() =>
				data.getOwnedMessages(db, {
					updatedAfter: resumedFrom,
					...ownership,
				}),
		),
	]);

	const rows = [...core.rows, ...external.rows, ...ownedMessages.rows];
	const errors = [
		...discoveryErrorsToSyncErrors(catalog.errors ?? []),
		...core.errors,
		...external.errors,
		...ownedMessages.errors,
	];

	if (discoveryComplete) {
		rows.push({
			service: EVY_CORE_SERVICE,
			resource: RESOURCE_CATALOG_KEY,
			value: catalog,
		});
	}

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
