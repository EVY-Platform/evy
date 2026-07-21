/**
 * Wire-protocol constants and shapes for the dataChanged notification
 * spoken by api, marketplace, web, and iOS.
 */

export const DATA_CHANGED_EVENT = "dataChanged" as const;

export type DataChangedOperation = "create" | "update" | "delete";

export type DataChangedNotification = {
	service: string;
	resource: string;
	operation: DataChangedOperation;
	value: unknown;
};
