import type { HookRequest, HookResponse } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";

import { enqueuePurchaseReaction, validatePurchaseMessage } from "./purchase";
import { MARKETPLACE_RESOURCE } from "./resources";

type MessageHookData = HookRequest["data"] & {
	fk: string;
	type: string;
	value: string;
};

function isMarketplaceMessageHook(params: HookRequest): boolean {
	return (
		params.resource === EVY_CORE_RESOURCE_REF.MESSAGES &&
		params.data.resource === MARKETPLACE_RESOURCE.ITEMS
	);
}

function asMessageData(data: HookRequest["data"]): MessageHookData {
	return data as MessageHookData;
}

export async function handleHook(params: HookRequest): Promise<HookResponse> {
	if (!isMarketplaceMessageHook(params)) {
		return { ok: true };
	}

	const message = asMessageData(params.data);

	switch (params.hook) {
		case "before_create": {
			const verdict = await validatePurchaseMessage(message);
			if (!verdict.ok) {
				return { ok: false, reason: verdict.reason };
			}
			return { ok: true };
		}
		case "after_create":
			enqueuePurchaseReaction(message);
			return { ok: true };
	}
}
