import { inArray, type SQL } from "drizzle-orm";
import type { DATA_EVY_Message } from "evy-types";
import { message } from "evy-types/db/schema.generated";
import { validateDataEvyMessage } from "evy-types/validators";
import { makeCoreResource, ownedIdsOf, type SyncScope } from "./coreResource";

function responseClause(ownedMessageIds: string[]): SQL | undefined {
	if (ownedMessageIds.length === 0) return undefined;
	return inArray(message.parent_message_id, ownedMessageIds);
}

export const messagesResource = makeCoreResource<DATA_EVY_Message>({
	table: message,
	validate: validateDataEvyMessage,
	toUpdateSet: (v) => ({
		fk: v.fk,
		service: v.service,
		resource: v.resource,
		data: v.data,
		parent_message_id: v.parent_message_id,
		visibility: v.visibility,
	}),
	extraSyncEntitlements: (scope: SyncScope) => [
		responseClause(ownedIdsOf(scope)),
	],
});
