/* eslint-disable */
/** Generated from schema/rpc/dataUpdated.notification.schema.json - do not edit. */

/**
 * JSON-RPC notification payload for dataUpdated event
 */
export interface DataUpdatedNotification {
  id: string;
  data: {
    [k: string]:
      | (string | number | boolean | null)
      | (string | number | boolean | null)[]
      | {
          [k: string]: string | number | boolean | null;
        };
  };
  createdAt: string;
  updatedAt: string;
}
