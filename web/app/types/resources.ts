/**
 * Plain data shapes shared by the sync layer and the flows context.
 * They live here (not in api/) so state/ can type its context without
 * importing the WebSocket client chain.
 */
export type ServiceResource = {
	id: string;
	serviceId: string;
	name: string;
};

export type ResourceAttributeMetadata = {
	serviceId: string;
	resourceId: string;
	attributeNames: string[];
};
