import { and, eq, isNull } from "drizzle-orm";
import type { DATA_EVY_Message, DATA_EVY_Transaction } from "evy-types";
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

export function derivedMessageData(
	source: Pick<
		DATA_EVY_Message,
		"fk" | "resource" | "type" | "data" | "visibility" | "parent_message_id"
	>,
	overrides: {
		value: string;
		data: Record<string, unknown>;
		visibility: DATA_EVY_Message["visibility"];
	},
): Record<string, unknown> {
	const messageData: Record<string, unknown> = {
		fk: source.fk,
		resource: source.resource,
		type: source.type,
		value: overrides.value,
		data: overrides.data,
		visibility: overrides.visibility,
	};
	if (typeof source.parent_message_id === "string") {
		messageData.parent_message_id = source.parent_message_id;
	}
	return messageData;
}

export async function appendTransactionRow(
	db: EvyDb,
	source: TransactionRowSource,
	type: DATA_EVY_Transaction["type"],
	status: DATA_EVY_Transaction["status"],
): Promise<DATA_EVY_Transaction> {
	return (await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
		data: {
			fk: source.fk,
			resource: source.resource,
			type,
			status,
			amount: source.amount,
			currency: source.currency,
			payment_provider_fee: 0,
			service_fee: 0,
			payment_provider: "stripe",
			payment_provider_transaction_id:
				source.payment_provider_transaction_id,
			signature: "signed",
			authorization_message_id: source.authorization_message_id,
			visibility: EVY_CORE_RESOURCE_VISIBILITY.transactions,
		},
	})) as DATA_EVY_Transaction;
}
