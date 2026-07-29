import { inArray, type SQL, sql } from "drizzle-orm";
import type { DATA_EVY_Message } from "evy-types";
import { message } from "evy-types/db/schema.generated";
import { validateDataEvyMessage } from "evy-types/validators";
import { makeCoreResource, ownedIdsOf, type SyncScope } from "./coreResource";

// bun-sql stores jsonb as a JSON string; unwrap so `data ->> 'key'` works in SQL
const messageDataObject = sql`(CASE
	WHEN jsonb_typeof(${message.data}) = 'object' THEN ${message.data}
	WHEN jsonb_typeof(${message.data}) = 'string'
		AND left(${message.data} #>> '{}', 1) = '{'
		THEN (${message.data} #>> '{}')::jsonb
	ELSE '{}'::jsonb
END)`;

function responseClause(ownedMessageIds: string[]): SQL | undefined {
	if (ownedMessageIds.length === 0) return undefined;
	return inArray(
		sql`lower(${messageDataObject} ->> 'message_id')`,
		ownedMessageIds.map((id) => id.toLowerCase()),
	);
}

export const messagesResource = makeCoreResource<DATA_EVY_Message>({
	table: message,
	validate: validateDataEvyMessage,
	toUpdateSet: (v) => ({
		fk: v.fk,
		service: v.service,
		resource: v.resource,
		data: v.data,
		visibility: v.visibility,
	}),
	extraSyncEntitlements: (scope: SyncScope) => [
		responseClause(ownedIdsOf(scope)),
	],
});
