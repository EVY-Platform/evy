import type { SDUI_Flow } from "evy-types/sdui/evy";

declare global {
	interface Window {
		__TEST_FLOWS__?: SDUI_Flow[];
	}
}
