/* eslint-disable */
/** Generated from schema/rpc/upsert.request.schema.json - do not edit. */

/**
 * JSON-RPC params for upsert method
 */
export interface UpsertRequest {
  namespace: "evy" | "marketplace";
  resource:
    | "SDUI"
    | "Device"
    | "Organisation"
    | "Service"
    | "Provider"
    | "SellingReason"
    | "Conditions"
    | "Durations"
    | "Items";
  filter?: IdFilter;
  data: {
    [k: string]:
      | (string | number | boolean | null)
      | (string | number | boolean | null)[]
      | {
          [k: string]: string | number | boolean | null;
        };
  };
}
export interface IdFilter {
  id: string;
}
