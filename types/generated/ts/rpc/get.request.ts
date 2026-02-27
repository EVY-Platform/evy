/* eslint-disable */
/** Generated from schema/rpc/get.request.schema.json - do not edit. */

/**
 * JSON-RPC params for get method
 */
export interface GetRequest {
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
}
export interface IdFilter {
  id: string;
}
