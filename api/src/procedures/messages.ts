import type { DATA_EVY_Message } from "evy-types";

/**
 * Build the create payload for a message derived from an existing one
 * (e.g. request_failed / charge_failed follow-ups): same thread and
 * resource, caller-chosen value, data, and visibility.
 */
export function derivedMessageData(
	source: Pick<
		DATA_EVY_Message,
		"fk" | "resource" | "type" | "data" | "visibility" | "parent_message_id"
	>,
	overrides: {
		value: string;
		data: Record<string, unknown>;
		visibility: DATA_EVY_Message["visibility"];
	},
): Record<string, unknown> {
	const messageData: Record<string, unknown> = {
		fk: source.fk,
		resource: source.resource,
		type: source.type,
		value: overrides.value,
		data: overrides.data,
		visibility: overrides.visibility,
	};
	if (typeof source.parent_message_id === "string") {
		messageData.parent_message_id = source.parent_message_id;
	}
	return messageData;
}
