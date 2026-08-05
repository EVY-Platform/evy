import { and, eq, isNull } from "drizzle-orm";
import type { DATA_EVY_Transaction, PaymentWebhookRequest } from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_RESOURCE_VISIBILITY,
} from "evy-types/coreResources";
import { transaction } from "evy-types/db/schema.generated";
import type { EvyDb } from "../database/db";
import { hookedCreate } from "./hooks";

type TransactionRowSource = Pick<
	DATA_EVY_Transaction,
	| "fk"
	| "resource"
	| "amount"
	| "currency"
	| "payment_provider_transaction_id"
	| "authorization_message_id"
>;

/** Stripe metadata attached to intents and transfers for reconciliation. */
export function paymentMetadata(
	source: Pick<
		TransactionRowSource,
		"fk" | "resource" | "authorization_message_id"
	>,
): { fk: string; resource: string; authorization_message_id: string } {
	return {
		fk: source.fk,
		resource: source.resource,
		authorization_message_id: source.authorization_message_id,
	};
}

export function paymentWebhookRequest(
	type: PaymentWebhookRequest["type"],
	paymentIntentId: string,
	error?: string,
): PaymentWebhookRequest {
	const request: PaymentWebhookRequest = {
		type,
		payment_intent_id: paymentIntentId,
	};
	if (error) {
		request.error = error;
	}
	return request;
}

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

function findIntentRow(
	rows: DATA_EVY_Transaction[],
): DATA_EVY_Transaction | undefined {
	return rows.find((row) => row.type === "charge" && row.status === "intent");
}

export async function requireIntent(
	db: EvyDb,
	paymentIntentId: string,
): Promise<{ rows: DATA_EVY_Transaction[]; intent: DATA_EVY_Transaction }> {
	const rows = await findRowsByIntentId(db, paymentIntentId);
	const intent = findIntentRow(rows);
	if (!intent) {
		throw new Error(`payment intent not found: ${paymentIntentId}`);
	}
	return { rows, intent };
}

export async function appendTransactionRow(
	db: EvyDb,
	source: TransactionRowSource,
	type: DATA_EVY_Transaction["type"],
	status: DATA_EVY_Transaction["status"],
	error?: string,
): Promise<DATA_EVY_Transaction> {
	const data: Record<string, unknown> = {
		fk: source.fk,
		resource: source.resource,
		type,
		status,
		amount: source.amount,
		currency: source.currency,
		payment_provider_fee: 0,
		service_fee: 0,
		payment_provider: "stripe",
		payment_provider_transaction_id: source.payment_provider_transaction_id,
		signature: "signed",
		authorization_message_id: source.authorization_message_id,
		visibility: EVY_CORE_RESOURCE_VISIBILITY.transactions,
	};
	if (error) {
		data.error = error;
	}
	return (await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
		data,
	})) as DATA_EVY_Transaction;
}
