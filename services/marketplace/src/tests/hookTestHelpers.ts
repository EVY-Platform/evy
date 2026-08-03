import type { HookRequest } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";

import { MARKETPLACE_RESOURCE } from "../resources";

export function makeHookRequest(fk: string): HookRequest {
	return {
		hook: "before_create",
		resource: EVY_CORE_RESOURCE_REF.MESSAGES,
		data: {
			fk,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			type: "pickup",
			value: "pending",
			data: { time: "2026-06-03T09:00:00" },
			visibility: "private",
		},
	};
}
