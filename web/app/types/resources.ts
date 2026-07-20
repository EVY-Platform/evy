/**
 * Plain data shapes shared by the sync layer and the flows context.
 * They live here (not in api/) so state/ can type its context without
 * importing the WebSocket client chain.
 */
import type { DATA_EVY_ServiceResource } from "evy-types";

export type ServiceResource = Pick<
	DATA_EVY_ServiceResource,
	"id" | "fkServiceId" | "name"
>;

export type ResourceAttributeMetadata = {
	serviceId: string;
	resourceId: string;
	attributeNames: string[];
};
