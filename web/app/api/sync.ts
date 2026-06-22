import type { SyncResponse, UI_Flow as ServerFlow } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { isServerFlow, wsClient } from "./wsClient";

export type ServiceResource = {
	id: string;
	fkServiceId: string;
	name: string;
};

function extractSduiFlows(response: SyncResponse): ServerFlow[] {
	const sduiRow = response.data.find(
		(row) => row.service === EVY_CORE_SERVICE && row.resource === "sdui",
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

function isServiceResource(item: unknown): item is ServiceResource {
	if (typeof item !== "object" || item === null) {
		return false;
	}

	const record = item as Record<string, unknown>;
	return (
		typeof record.id === "string" &&
		typeof record.fkServiceId === "string" &&
		typeof record.name === "string"
	);
}

function extractServiceResources(response: SyncResponse): ServiceResource[] {
	const row = response.data.find(
		(row) =>
			row.service === EVY_CORE_SERVICE && row.resource === "serviceResources",
	);
	if (!Array.isArray(row?.value)) return [];
	return (row.value as unknown[]).filter(isServiceResource);
}

const EPOCH = "1970-01-01T00:00:00.000Z";

export async function syncWebData(): Promise<{
	flows: ServerFlow[];
	serviceResources: ServiceResource[];
}> {
	const response = await wsClient.sync(EPOCH);
	return {
		flows: extractSduiFlows(response),
		serviceResources: extractServiceResources(response),
	};
}
