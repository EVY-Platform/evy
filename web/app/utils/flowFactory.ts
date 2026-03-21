import type {
	SDUI_Flow as ServerFlow,
	SDUI_Page as ServerPage,
} from "evy-types";

import type { SDUI_Flow } from "../types/flow";
import { decodeFlows } from "./decodeFlow";

/**
 * Builds a minimal valid blank page for the builder UI and API validation.
 */
export function buildNewClientPage(): ServerPage {
	return {
		id: crypto.randomUUID(),
		title: "",
		rows: [],
	};
}

/**
 * Builds a minimal valid flow (one empty page) for the builder UI and API validation.
 */
export function buildNewClientFlow(name: string): SDUI_Flow {
	const flowId = crypto.randomUUID();
	const serverFlow: ServerFlow = {
		id: flowId,
		name,
		pages: [buildNewClientPage()],
	};
	return decodeFlows([serverFlow])[0];
}
