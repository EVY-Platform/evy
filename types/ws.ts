/**
 * Wire-protocol constants and shapes for the dataChanged notification
 * spoken by api, marketplace, web, and iOS.
 */

export const DATA_CHANGED_EVENT = "data_changed" as const;

export type DataChangedOperation = "create" | "update" | "delete";

export type DataChangedNotification = {
	resource: string;
	operation: DataChangedOperation;
	value: unknown;
};
