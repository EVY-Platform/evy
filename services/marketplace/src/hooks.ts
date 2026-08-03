import type { HookRequest, HookResponse } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";

import {
	enqueuePurchaseReaction,
	enqueueTransactionReaction,
	validatePurchaseMessage,
} from "./purchase";
import { MARKETPLACE_RESOURCE } from "./resources";

type MessageHookData = HookRequest["data"] & {
	fk: string;
	type: string;
	value: string;
};

type TransactionHookData = HookRequest["data"] & {
	fk: string;
	resource: string;
	type: string;
	status: string;
};

function isMarketplaceMessageHook(params: HookRequest): boolean {
	return (
		params.resource === EVY_CORE_RESOURCE_REF.MESSAGES &&
		params.data.resource === MARKETPLACE_RESOURCE.ITEMS
	);
}

function isMarketplaceTransactionHook(params: HookRequest): boolean {
	return (
		params.resource === EVY_CORE_RESOURCE_REF.TRANSACTIONS &&
		params.data.resource === MARKETPLACE_RESOURCE.ITEMS
	);
}

export async function handleHook(params: HookRequest): Promise<HookResponse> {
	if (isMarketplaceTransactionHook(params)) {
		if (params.hook === "after_create") {
			enqueueTransactionReaction(params.data as TransactionHookData);
		}
		return { ok: true };
	}

	if (!isMarketplaceMessageHook(params)) {
		return { ok: true };
	}

	const message = params.data as MessageHookData;

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
