import type { SyncResponse, UI_Flow as ServerFlow } from "evy-types";
import { isServerFlow, wsClient } from "./wsClient";

function extractSduiFlows(response: SyncResponse): ServerFlow[] {
	const sduiRow = response.data.find(
		(row) => row.service === "evy" && row.resource === "sdui",
	);

	const value = sduiRow?.value;
	if (!Array.isArray(value)) {
		return [];
	}

	if (!value.every(isServerFlow)) {
		throw new Error("Invalid flows in sync response");
	}

	return value;
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
