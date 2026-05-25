import type { SyncResponse, UI_Flow as ServerFlow } from "evy-types";
import { isServerFlow, wsClient } from "./wsClient";

function extractSduiFlows(response: SyncResponse): ServerFlow[] {
	const sduiRow = response.data.find(
		(row) => row.service === "evy" && row.resource === "sdui",
	);

	const value = sduiRow?.value;
	if (!isGetResponseEnvelope(value)) {
		return [];
	}

	const flows = value.data;
	if (!flows.every(isServerFlow)) {
		throw new Error("Invalid flows in sync response");
	}

	if (!hasOrder(value.metadata)) {
		return flows;
	}

	const orderIndexById = new Map(
		value.metadata.order.map((id, index) => [id, index]),
	);
	return [...flows].sort(
		(a, b) =>
			(orderIndexById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
			(orderIndexById.get(b.id) ?? Number.MAX_SAFE_INTEGER),
	);
}

function isGetResponseEnvelope(
	value: unknown,
): value is { metadata: unknown; data: unknown[] } {
	return (
		value !== null &&
		typeof value === "object" &&
		"metadata" in value &&
		"data" in value &&
		Array.isArray(value.data)
	);
}

function hasOrder(value: unknown): value is { order: string[] } {
	return (
		value !== null &&
		typeof value === "object" &&
		"order" in value &&
		Array.isArray(value.order) &&
		value.order.every((id) => typeof id === "string")
	);
}

const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Unify startup data loading around the platform `sync` method.
 *
 * Mirrors iOS `EVY.sync()` — for now only SDUI flows are consumed;
 * other sync rows are fetched but not persisted.
 */
export async function syncWebData(): Promise<ServerFlow[]> {
	const response = await wsClient.sync(EPOCH);
	return extractSduiFlows(response);
}
