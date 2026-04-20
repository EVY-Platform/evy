import type { DATA_PRIMITIVE } from "evy-types";
import {
	assertIsoDateTimeJsonFields,
	validateUpsertDataPayload,
} from "evy-types/validators";

export function validateDataPayload(data: unknown): DATA_PRIMITIVE["data"] {
	const validated = validateUpsertDataPayload(data);
	assertIsoDateTimeJsonFields(validated);
	return validated;
}
