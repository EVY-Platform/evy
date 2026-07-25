/**
 * Tombstone retention.
 *
 * A delete is a soft delete: the row stays with `deletedAt` set so sync can
 * tell clients to drop it. They cannot stay forever, but they also cannot be
 * removed the moment they are applied — a client that has been offline still
 * needs to learn about deletes it missed.
 *
 * So tombstones are kept for a retention window and purged after it, and the
 * same window bounds how old a sync cursor may be. A client resuming from
 * before the horizon might have missed a purged tombstone, and because nothing
 * would ever tell it about that record again, it is sent a full snapshot with
 * `reset` instead.
 */

import { lt } from "drizzle-orm";
import {
	address,
	file,
	flow,
	message,
	organization,
	page,
	row,
	service,
	serviceProvider,
	serviceResource,
} from "evy-types/db/schema.generated";
import type { EvyDb } from "../database/db";

const DEFAULT_RETENTION_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Every table whose deletes leave a tombstone. */
const SOFT_DELETED_TABLES = {
	Service: service,
	Organization: organization,
	ServiceProvider: serviceProvider,
	ServiceResource: serviceResource,
	Flow: flow,
	Page: page,
	Row: row,
	File: file,
	Address: address,
	Message: message,
} as const;

export function tombstoneRetentionDays(): number {
	const configured = Number(process.env.TOMBSTONE_RETENTION_DAYS);
	return Number.isFinite(configured) && configured > 0
		? configured
		: DEFAULT_RETENTION_DAYS;
}

/**
 * Tombstones deleted before this are gone, so a cursor older than it cannot be
 * resumed from.
 */
export function tombstoneHorizon(now: Date = new Date()): string {
	return new Date(
		now.getTime() - tombstoneRetentionDays() * MS_PER_DAY,
	).toISOString();
}

/**
 * True when a cursor predates the horizon and may therefore have missed a
 * purged tombstone. An absent cursor is already a full sync, not a stale one.
 */
export function isCursorExpired(
	cursor: string | undefined,
	horizon: string = tombstoneHorizon(),
): boolean {
	if (!cursor) return false;
	return cursor < horizon;
}

interface PurgeResult {
	horizon: string;
	purged: Record<string, number>;
	total: number;
}

/** Deletes tombstones older than the retention window, for real. */
export async function purgeTombstones(
	db: EvyDb,
	now: Date = new Date(),
): Promise<PurgeResult> {
	const horizon = tombstoneHorizon(now);
	const purged: Record<string, number> = {};
	let total = 0;

	for (const [name, table] of Object.entries(SOFT_DELETED_TABLES)) {
		const removed = await db
			.delete(table)
			.where(lt(table.deletedAt, horizon))
			.returning({ id: table.id });
		if (removed.length > 0) {
			purged[name] = removed.length;
			total += removed.length;
		}
	}

	return { horizon, purged, total };
}
