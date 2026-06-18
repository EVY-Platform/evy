import type { UI_Flow } from "evy-types";
import type { ServiceResource } from "../api/sync";

declare global {
	interface Window {
		__TEST_FLOWS__?: UI_Flow[];
		__TEST_SERVICE_RESOURCES__?: ServiceResource[];
	}
}
