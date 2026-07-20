import { EventEmitter } from "node:events";
import { MARKETPLACE_SERVICE } from "./resources";

export const DATA_CHANGED_EVENT = "dataChanged" as const;

const marketplaceEventBus = new EventEmitter();
marketplaceEventBus.setMaxListeners(0);

type ServiceEventListener = (eventName: string, payload: unknown) => void;

export function emitDataChanged(
	resource: string,
	operation: "create" | "update" | "delete",
	value: unknown,
): void {
	marketplaceEventBus.emit("notify", DATA_CHANGED_EVENT, {
		service: MARKETPLACE_SERVICE,
		resource,
		operation,
		value,
	});
}

export function onServiceEvent(listener: ServiceEventListener): void {
	marketplaceEventBus.on("notify", listener);
}
