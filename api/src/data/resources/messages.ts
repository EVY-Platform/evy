import type { DATA_EVY_Message } from "evy-types";
import { message } from "evy-types/db/schema.generated";
import { validateDataEvyMessage } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

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
