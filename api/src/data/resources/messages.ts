import { and, asc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { DATA_EVY_Message, GetResponse } from "evy-types";
import { message } from "evy-types/db/schema.generated";
import {
	validateDataEvyMessage,
	validateGetResponse,
} from "evy-types/validators";
import type { EvyDb } from "../../database/db";
import {
	makeCoreResource,
	type OwnedServiceResource,
	omitNulls,
	type SyncScope,
	syncEntitlementClause,
	syncTimeClause,
} from "./coreResource";

const baseMessagesResource = makeCoreResource<DATA_EVY_Message>({
	table: message,
	validate: validateDataEvyMessage,
	toUpdateSet: (v) => ({
		fk: v.fk,
		service: v.service,
		resource: v.resource,
		data: v.data,
		visibility: v.visibility,
	}),
});

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Messages are the one resource with a recipient as well as an owner: whoever owns
 * the record a message addresses is entitled to it, even though they did not create
 * it and do not hold it yet.
 *
 * Groups whose service or resource is not a uuid are dropped rather than queried.
 * `Message.service` and `Message.resource` are uuid columns, so comparing them
 * against a core resource name would make Postgres throw on the cast - and a
 * message can never reference a core resource by name anyway, so such a group could
 * not match.
 */
function recipientClause(
	ownedForeignKeys: OwnedServiceResource[],
): SQL | undefined {
	const clauses: SQL[] = [];

	for (const group of ownedForeignKeys) {
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

	if (clauses.length === 0) return undefined;
	return clauses.length === 1 ? clauses[0] : or(...clauses);
}

/**
 * `Message.data` as a jsonb object, whichever way it was stored.
 *
 * The `bun-sql` driver serialises a jsonb column by JSON-stringifying its value, so a row
 * written through the API holds a jsonb *string* containing the object rather than the
 * object itself. Reads are symmetric - the driver parses it back - so JavaScript never
 * notices, and a properly-encoded object decodes just as well. SQL does notice:
 * `data ->> 'key'` is NULL on the string form, which would make any clause reaching into
 * `data` silently match nothing.
 *
 * This affects every jsonb column in the schema, not only this one. Normalising the whole
 * database and fixing the write path is its own change; until then, read tolerantly.
 * Never throws: a string that is not a JSON object falls through to an empty object rather
 * than failing the cast and taking the resource's sync down with it.
 */
const messageDataObject = sql`(CASE
	WHEN jsonb_typeof(${message.data}) = 'object' THEN ${message.data}
	WHEN jsonb_typeof(${message.data}) = 'string'
		AND left(${message.data} #>> '{}', 1) = '{'
		THEN (${message.data} #>> '{}')::jsonb
	ELSE '{}'::jsonb
END)`;

/**
 * A message answering a message you own is yours.
 *
 * A response addresses whatever record its request addressed, so `recipientClause`
 * already delivers it to that record's owner - who is the one that answered. The
 * request's *sender* owns neither the response nor that record, only the request, so
 * without this clause the answer would never reach the person who asked.
 *
 * Matched through `data` rather than through `fk`/`service`/`resource`, because those
 * are uuid columns while core resources are addressed by name: a message can never
 * address another message directly. `->>` yields text, so a missing or malformed value
 * simply fails to match instead of throwing on a cast.
 */
function responseClause(ownedMessageIds: string[]): SQL | undefined {
	if (ownedMessageIds.length === 0) return undefined;
	return inArray(
		sql`lower(${messageDataObject} ->> 'message_id')`,
		ownedMessageIds.map((id) => id.toLowerCase()),
	);
}

/** The generic entitlement, widened by the recipient and response rules. */
async function listMessagesForSync(
	db: EvyDb,
	scope: SyncScope,
): Promise<GetResponse> {
	const entitlement = [
		syncEntitlementClause(message, scope.ownedIds),
		recipientClause(scope.ownedForeignKeys),
		responseClause(scope.ownedIds),
	].filter((clause): clause is SQL => clause !== undefined);

	const clauses = [
		syncTimeClause(message, scope.updatedAfter),
		entitlement.length > 1 ? or(...entitlement) : entitlement[0],
	].filter((clause): clause is SQL => clause !== undefined);

	const rows = await db
		.select()
		.from(message)
		.where(clauses.length > 0 ? and(...clauses) : undefined)
		.orderBy(asc(message.updatedAt), asc(message.id));

	return validateGetResponse(
		rows.map((row) => validateDataEvyMessage(omitNulls(row))),
	);
}

export const messagesResource = {
	...baseMessagesResource,
	listForSync: listMessagesForSync,
};
