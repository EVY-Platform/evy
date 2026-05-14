import type { DataUpdatedNotification } from "evy-types";
import type { BroadcastFn } from "./broadcast";

export type DataUpdatedNotificationPayload = DataUpdatedNotification;

let broadcast: BroadcastFn | null = null;

export function initDataNotifications(broadcastFn: BroadcastFn | null): void {
	broadcast = broadcastFn;
}

export function emitDataUpdatedNotification(payload: {
	service: string;
	resource: string;
	value: unknown;
}): void {
	console.log("emitDataUpdatedNotification", JSON.stringify(payload, null, 2));
	broadcast?.("dataUpdated", payload as DataUpdatedNotificationPayload);
}
