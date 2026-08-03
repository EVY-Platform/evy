import { and, eq, isNull } from "drizzle-orm";
import type { DATA_EVY_Transaction } from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_RESOURCE_VISIBILITY,
} from "evy-types/coreResources";
import { transaction } from "evy-types/db/schema.generated";
import type { EvyDb } from "../database/db";
import { hookedCreate } from "./hooks";

export const MOCK_CAPTURE_FAILURE_AMOUNT = 6.66;
export const MOCK_TRANSFER_FAILURE_AMOUNT = 7.77;

export async function findRowsByIntentId(
	db: EvyDb,
	paymentIntentId: string,
): Promise<DATA_EVY_Transaction[]> {
	const rows = await db
		.select()
		.from(transaction)
		.where(
			and(
				eq(
					transaction.payment_provider_transaction_id,
					paymentIntentId,
				),
				isNull(transaction.deleted_at),
			),
		);
	return rows as DATA_EVY_Transaction[];
}

export function hasRow(
	rows: DATA_EVY_Transaction[],
	type: DATA_EVY_Transaction["type"],
	status: DATA_EVY_Transaction["status"],
): boolean {
	return rows.some((row) => row.type === type && row.status === status);
}

export function findIntentRow(
	rows: DATA_EVY_Transaction[],
): DATA_EVY_Transaction | undefined {
	return rows.find((row) => row.type === "charge" && row.status === "intent");
}

export async function appendTransactionRow(
	db: EvyDb,
	intent: DATA_EVY_Transaction,
	type: DATA_EVY_Transaction["type"],
	status: DATA_EVY_Transaction["status"],
): Promise<DATA_EVY_Transaction> {
	const visibility = EVY_CORE_RESOURCE_VISIBILITY.transactions;
	if (!visibility) {
		throw new Error("evy.transactions has no declared visibility");
	}

	return (await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
		data: {
			fk: intent.fk,
			resource: intent.resource,
			type,
			status,
			amount: intent.amount,
			currency: intent.currency,
			payment_provider_fee: 0,
			service_fee: 0,
			payment_provider: "stripe",
			payment_provider_transaction_id:
				intent.payment_provider_transaction_id,
			signature: "signed",
			authorization_message_id: intent.authorization_message_id,
			visibility,
		},
	})) as DATA_EVY_Transaction;
}
