import type { UI_Flow } from "evy-types";

declare global {
	interface Window {
		__TEST_FLOWS__?: UI_Flow[];
	}
}
