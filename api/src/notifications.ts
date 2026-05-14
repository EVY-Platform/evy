import type { BroadcastFn } from "./broadcast";

let broadcast: BroadcastFn | null = null;

export function initDataNotifications(broadcastFn: BroadcastFn | null): void {
	broadcast = broadcastFn;
}

export function emitDataUpdatedNotification(payload: {
	service: string;
	resource: string;
	value: unknown;
}): void {
	broadcast?.("dataUpdated", payload);
}
