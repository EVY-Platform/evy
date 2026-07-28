import { and, asc, eq, gt, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { DATA_EVY_Message, GetResponse, SyncRequest } from "evy-types";
import { message } from "evy-types/db/schema.generated";
import {
	validateDataEvyMessage,
	validateGetResponse,
} from "evy-types/validators";
import type { EvyDb } from "../../database/db";
import { makeCoreResource, omitNulls } from "./coreResource";

export const messagesResource = makeCoreResource<DATA_EVY_Message>({
	table: message,
	validate: validateDataEvyMessage,
	toUpdateSet: (v) => ({
		fk: v.fk,
		service: v.service,
		resource: v.resource,
		archivedAt: v.archivedAt ?? null,
		status: v.status,
		data: v.data,
		visibility: v.visibility,
	}),
});

/**
 * Ids a device owns within one service resource. Derived from the request schema
 * rather than restated, so a client cannot declare a shape this query does not
 * read.
 */
export type OwnedServiceResource = NonNullable<
	SyncRequest["ownedServiceResources"]
>[number];

export type OwnedMessagesParams = {
	updatedAfter?: string;
	/** Message ids the device created. */
	ownedMessageIds: string[];
	/** Records the device owns, which messages may be addressed to. */
	ownedForeignKeys: OwnedServiceResource[];
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The two ways a device is entitled to a message: it created it, or it owns the
 * record the message is addressed to.
 *
 * Groups whose service or resource is not a uuid are dropped rather than
 * queried. `Message.service` and `Message.resource` are uuid columns, so
 * comparing them against a core resource name would make Postgres throw on the
 * cast - and a message can never reference a core resource by name anyway, so
 * such a group could not match.
 */
function ownershipClauses(params: OwnedMessagesParams): SQL[] {
	const clauses: SQL[] = [];

	if (params.ownedMessageIds.length > 0) {
		clauses.push(inArray(message.id, params.ownedMessageIds));
	}

	for (const group of params.ownedForeignKeys) {
		if (group.ids.length === 0) continue;
		if (
			!UUID_PATTERN.test(group.service) ||
			!UUID_PATTERN.test(group.resource)
		) {
			continue;
		}
		clauses.push(
			and(
				eq(message.service, group.service),
				eq(message.resource, group.resource),
				inArray(message.fk, group.ids),
			) as SQL,
		);
	}

	return clauses;
}

/**
 * Messages this device is entitled to, rather than every message there is.
 *
 * `updatedAfter` behaves as it does in `coreResource.list`: an incremental read
 * carries tombstones, a plain read excludes them. An owner that never receives
 * the tombstone could never learn a message was withdrawn.
 */
export async function listOwnedMessages(
	db: EvyDb,
	params: OwnedMessagesParams,
): Promise<GetResponse> {
	const ownership = ownershipClauses(params);
	if (ownership.length === 0) return [];

	const timeClause = params.updatedAfter
		? gt(message.updatedAt, params.updatedAfter)
		: isNull(message.deletedAt);

	const rows = await db
		.select()
		.from(message)
		.where(and(timeClause, or(...ownership)))
		.orderBy(asc(message.updatedAt), asc(message.id));

	return validateGetResponse(
		rows.map((row) => validateDataEvyMessage(omitNulls(row))),
	);
}
