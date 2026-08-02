import type { DATA_EVY_Transaction } from "evy-types";
import { transaction } from "evy-types/db/schema.generated";
import { validateDataEvyTransaction } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const transactionsResource = makeCoreResource<DATA_EVY_Transaction>({
	table: transaction,
	validate: validateDataEvyTransaction,
	toUpdateSet: (v) => ({
		fk: v.fk,
		resource: v.resource,
		type: v.type,
		amount: v.amount,
		currency: v.currency,
		payment_provider_fee: v.payment_provider_fee,
		service_fee: v.service_fee,
		payment_provider: v.payment_provider,
		payment_provider_transaction_id: v.payment_provider_transaction_id,
		signature: v.signature,
		authorization_message_id: v.authorization_message_id,
		visibility: v.visibility,
	}),
});
