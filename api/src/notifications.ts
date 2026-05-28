import type { BroadcastFn } from "./broadcast";

let broadcast: BroadcastFn | null = null;

export function initDataNotifications(broadcastFn: BroadcastFn | null): void {
	broadcast = broadcastFn;
}

export function emitDataChangedNotification(payload: {
	service: string;
	resource: string;
	operation: "create" | "update" | "delete";
	value: unknown;
}): void {
	broadcast?.("dataChanged", payload);
}
