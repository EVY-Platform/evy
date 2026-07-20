import type { UI_Flow } from "evy-types";
import type { ResourceAttributeMetadata, ServiceResource } from "./resources";

declare global {
	interface Window {
		__TEST_FLOWS__?: UI_Flow[];
		__TEST_SERVICE_RESOURCES__?: ServiceResource[];
		__TEST_RESOURCE_ATTRIBUTE_METADATA__?: ResourceAttributeMetadata[];
	}
}
