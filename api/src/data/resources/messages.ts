import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { DATA_EVY_Message } from "evy-types";
import { message } from "evy-types/db/schema.generated";
import { validateDataEvyMessage } from "evy-types/validators";
import type { EvyDb } from "../../database/db";
import {
	makeCoreResource,
	type OwnedServiceResource,
	omitNulls,
	runListForSync,
	type SyncScope,
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

// bun-sql stores jsonb as a JSON string; unwrap so `data ->> 'key'` works in SQL
const messageDataObject = sql`(CASE
	WHEN jsonb_typeof(${message.data}) = 'object' THEN ${message.data}
	WHEN jsonb_typeof(${message.data}) = 'string'
		AND left(${message.data} #>> '{}', 1) = '{'
		THEN (${message.data} #>> '{}')::jsonb
	ELSE '{}'::jsonb
END)`;

// Entitles the request sender to responses matched on data.message_id
function responseClause(ownedMessageIds: string[]): SQL | undefined {
	if (ownedMessageIds.length === 0) return undefined;
	return inArray(
		sql`lower(${messageDataObject} ->> 'message_id')`,
		ownedMessageIds.map((id) => id.toLowerCase()),
	);
}

async function listMessagesForSync(
	db: EvyDb,
	scope: SyncScope,
): Promise<GetResponse> {
	return runListForSync(
		db,
		message,
		scope,
		(row) => validateDataEvyMessage(omitNulls(row)),
		[
			recipientClause(scope.ownedForeignKeys),
			responseClause(scope.ownedIds),
		].filter((clause): clause is SQL => clause !== undefined),
	);
}

export const messagesResource = {
	...baseMessagesResource,
	listForSync: listMessagesForSync,
};
