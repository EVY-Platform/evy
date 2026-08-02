import type { ChargeRequest, ChargeResponse } from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_RESOURCE_VISIBILITY,
} from "evy-types/coreResources";
import { validateChargeResponse } from "evy-types/validators";
import { create } from "../data/data";
import type { EvyDb } from "../database/db";

export async function charge(
	params: ChargeRequest,
	db: EvyDb,
): Promise<ChargeResponse> {
	const visibility = EVY_CORE_RESOURCE_VISIBILITY.transactions;
	if (!visibility) {
		throw new Error("evy.transactions has no declared visibility");
	}

	return validateChargeResponse(
		await create(db, {
			resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
			data: {
				fk: params.fk,
				resource: params.resource,
				type: "charge",
				amount: params.amount,
				currency: params.currency,
				payment_provider_fee: 0,
				service_fee: 0,
				payment_provider: "stripe",
				payment_provider_transaction_id: crypto.randomUUID(),
				signature: "signed",
				authorization_message_id: params.authorization_message_id,
				visibility,
			},
		}),
	);
}
