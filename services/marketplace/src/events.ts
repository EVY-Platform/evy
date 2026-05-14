import { EventEmitter } from "node:events";
import { MARKETPLACE_SERVICE } from "./catalog";

const marketplaceEventBus = new EventEmitter();
marketplaceEventBus.setMaxListeners(0);

export type ServiceEventListener = (
	eventName: string,
	payload: unknown,
) => void;

export function emitDataUpdated(resource: string, value: unknown): void {
	marketplaceEventBus.emit("notify", "dataUpdated", {
		service: MARKETPLACE_SERVICE,
		resource,
		value,
	});
}

export function onServiceEvent(listener: ServiceEventListener): void {
	marketplaceEventBus.on("notify", listener);
}

export function offServiceEvent(listener: ServiceEventListener): void {
	marketplaceEventBus.off("notify", listener);
}
