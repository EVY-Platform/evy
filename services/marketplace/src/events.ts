import { EventEmitter } from "node:events";
import {
	DATA_CHANGED_EVENT,
	type DataChangedNotification,
	type DataChangedOperation,
} from "evy-types/ws";
import { MARKETPLACE_SERVICE } from "./resources";

export { DATA_CHANGED_EVENT };

const marketplaceEventBus = new EventEmitter();
marketplaceEventBus.setMaxListeners(0);

type ServiceEventListener = (eventName: string, payload: unknown) => void;

export function emitDataChanged(
	resource: string,
	operation: DataChangedOperation,
	value: unknown,
): void {
	const notification: DataChangedNotification = {
		service: MARKETPLACE_SERVICE,
		resource,
		operation,
		value,
	};
	marketplaceEventBus.emit("notify", DATA_CHANGED_EVENT, notification);
}

export function onServiceEvent(listener: ServiceEventListener): void {
	marketplaceEventBus.on("notify", listener);
}
