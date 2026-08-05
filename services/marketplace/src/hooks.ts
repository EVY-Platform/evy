import type { HookRequest, HookResponse } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import { runPaymentReaction, validatePaymentPreconditions } from "./payments";
import {
	enqueuePurchaseReaction,
	enqueueTransactionReaction,
	type MessagePayload,
	type TransactionPayload,
	validatePurchaseMessage,
} from "./purchase";
import { MARKETPLACE_RESOURCE } from "./resources";

function isMarketplaceHook(params: HookRequest, coreRef: string): boolean {
	return (
		params.resource === coreRef &&
		params.data.resource === MARKETPLACE_RESOURCE.ITEMS
	);
}

export async function handleHook(params: HookRequest): Promise<HookResponse> {
	if (isMarketplaceHook(params, EVY_CORE_RESOURCE_REF.TRANSACTIONS)) {
		if (params.hook === "after_create") {
			enqueueTransactionReaction(params.data as TransactionPayload);
		}
		return { ok: true };
	}

	if (!isMarketplaceHook(params, EVY_CORE_RESOURCE_REF.MESSAGES)) {
		return { ok: true };
	}

	const message = params.data as MessagePayload;

	switch (params.hook) {
		case "before_create": {
			const verdict = await validatePurchaseMessage(message);
			if (!verdict.ok) {
				return { ok: false, reason: verdict.reason };
			}
			const paymentVerdict = await validatePaymentPreconditions(message);
			if (!paymentVerdict.ok) {
				return { ok: false, reason: paymentVerdict.reason };
			}
			return { ok: true };
		}
		case "after_create":
			enqueuePurchaseReaction(message);
			await runPaymentReaction(message);
			return { ok: true };
	}
}
