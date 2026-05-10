import type { UI_Flow as ServerFlow, UI_Page as ServerPage } from "evy-types";

import type { UI_Flow, UI_Page } from "../types/flow";
import { decodeFlows } from "./decodeFlow";

/**
 * Builds a minimal valid blank page for the builder UI and API validation.
 */
export function buildNewClientPage(): UI_Page {
	return {
		id: crypto.randomUUID(),
		title: "",
		rows: [],
	};
}

/**
 * Builds a minimal valid flow (one empty page) for the builder UI and API validation.
 */
export function buildNewClientFlow(name: string): UI_Flow {
	const flowId = crypto.randomUUID();
	const serverPage: ServerPage = {
		id: crypto.randomUUID(),
		title: "",
		rows: [],
	};
	const serverFlow: ServerFlow = {
		id: flowId,
		name,
		pages: [serverPage],
	};
	return decodeFlows([serverFlow])[0];
}
