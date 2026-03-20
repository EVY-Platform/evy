import type { SDUI_Flow as ServerFlow } from "evy-types";

import type { SDUI_Flow } from "../types/flow";
import { decodeFlows } from "./decodeFlow";

/**
 * Builds a minimal valid flow (one empty page) for the builder UI and API validation.
 */
export function buildNewClientFlow(name: string): SDUI_Flow {
	const flowId = crypto.randomUUID();
	const pageId = crypto.randomUUID();
	const serverFlow: ServerFlow = {
		id: flowId,
		name,
		pages: [
			{
				id: pageId,
				title: "",
				rows: [],
			},
		],
	};
	return decodeFlows([serverFlow])[0];
}
