import { EventEmitter } from "node:events";
import { MARKETPLACE_SERVICE } from "./catalog";

const marketplaceEventBus = new EventEmitter();
marketplaceEventBus.setMaxListeners(0);

type ServiceEventListener = (eventName: string, payload: unknown) => void;

export function emitDataChanged(
	resource: string,
	operation: "create" | "update",
	value: unknown,
): void {
	marketplaceEventBus.emit("notify", "dataChanged", {
		service: MARKETPLACE_SERVICE,
		resource,
		operation,
		value,
	});
}

export function onServiceEvent(listener: ServiceEventListener): void {
	marketplaceEventBus.on("notify", listener);
}

export function offServiceEvent(listener: ServiceEventListener): void {
	marketplaceEventBus.off("notify", listener);
}
