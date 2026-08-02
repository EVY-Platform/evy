import { and, eq, isNull } from "drizzle-orm";
import type {
	DATA_EVY_Transaction,
	PaymentCaptureRequest,
	PaymentCaptureResponse,
	PaymentIntentRequest,
	PaymentIntentResponse,
	PaymentTransferRequest,
	PaymentTransferResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_RESOURCE_VISIBILITY,
} from "evy-types/coreResources";
import { transaction } from "evy-types/db/schema.generated";
import {
	validatePaymentCaptureResponse,
	validatePaymentIntentResponse,
	validatePaymentTransferResponse,
} from "evy-types/validators";
import { create } from "../data/data";
import type { EvyDb } from "../database/db";

async function findRowsByIntentId(
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

function findIntentRow(
	rows: DATA_EVY_Transaction[],
): DATA_EVY_Transaction | undefined {
	return rows.find((row) => row.type === "intent");
}

function hasCaptureRow(rows: DATA_EVY_Transaction[]): boolean {
	return rows.some((row) => row.type === "capture");
}

function hasTransferRow(rows: DATA_EVY_Transaction[]): boolean {
	return rows.some((row) => row.type === "transfer");
}

export async function paymentIntent(
	params: PaymentIntentRequest,
	db: EvyDb,
): Promise<PaymentIntentResponse> {
	const visibility = EVY_CORE_RESOURCE_VISIBILITY.transactions;
	if (!visibility) {
		throw new Error("evy.transactions has no declared visibility");
	}

	return validatePaymentIntentResponse(
		await create(db, {
			resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
			data: {
				fk: params.fk,
				resource: params.resource,
				type: "intent",
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

export async function paymentCapture(
	params: PaymentCaptureRequest,
	db: EvyDb,
): Promise<PaymentCaptureResponse> {
	const visibility = EVY_CORE_RESOURCE_VISIBILITY.transactions;
	if (!visibility) {
		throw new Error("evy.transactions has no declared visibility");
	}

	const rows = await findRowsByIntentId(db, params.payment_intent_id);
	const intent = findIntentRow(rows);
	if (!intent) {
		throw new Error(
			`payment intent not found: ${params.payment_intent_id}`,
		);
	}
	if (hasCaptureRow(rows)) {
		throw new Error(
			`payment intent already captured: ${params.payment_intent_id}`,
		);
	}

	return validatePaymentCaptureResponse(
		await create(db, {
			resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
			data: {
				fk: intent.fk,
				resource: intent.resource,
				type: "capture",
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
		}),
	);
}

export async function paymentTransfer(
	params: PaymentTransferRequest,
	db: EvyDb,
): Promise<PaymentTransferResponse> {
	const visibility = EVY_CORE_RESOURCE_VISIBILITY.transactions;
	if (!visibility) {
		throw new Error("evy.transactions has no declared visibility");
	}

	const rows = await findRowsByIntentId(db, params.payment_intent_id);
	const intent = findIntentRow(rows);
	if (!intent) {
		throw new Error(
			`payment intent not found: ${params.payment_intent_id}`,
		);
	}
	if (!hasCaptureRow(rows)) {
		throw new Error(
			`payment intent not captured: ${params.payment_intent_id}`,
		);
	}
	if (hasTransferRow(rows)) {
		throw new Error(
			`payment intent already transferred: ${params.payment_intent_id}`,
		);
	}

	return validatePaymentTransferResponse(
		await create(db, {
			resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
			data: {
				fk: intent.fk,
				resource: intent.resource,
				type: "transfer",
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
		}),
	);
}
