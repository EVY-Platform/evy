import type { SyncResponse, UI_Flow as ServerFlow } from "evy-types";
import { wsClient } from "./wsClient";

function isServerFlow(v: unknown): v is ServerFlow {
	return (
		v !== null &&
		typeof v === "object" &&
		"id" in v &&
		"name" in v &&
		typeof v.id === "string" &&
		typeof v.name === "string" &&
		"pages" in v &&
		Array.isArray(v.pages)
	);
}

function extractSduiFlows(response: SyncResponse): ServerFlow[] {
	const sduiRow = response.data.find(
		(row) => row.service === "evy" && row.resource === "sdui",
	);

	if (!sduiRow || !Array.isArray(sduiRow.value)) {
		return [];
	}

	const flows = sduiRow.value;
	if (!flows.every(isServerFlow)) {
		throw new Error("Invalid flows in sync response");
	}

	return flows;
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
