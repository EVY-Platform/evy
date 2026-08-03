import type {
	PaymentCaptureRequest,
	PaymentCaptureResponse,
	PaymentIntentRequest,
	PaymentIntentResponse,
	PaymentTransferRequest,
	PaymentTransferResponse,
	PaymentWebhookRequest,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_RESOURCE_VISIBILITY,
} from "evy-types/coreResources";
import {
	validatePaymentCaptureResponse,
	validatePaymentIntentResponse,
	validatePaymentTransferResponse,
} from "evy-types/validators";
import type { EvyDb } from "../database/db";
import { hookedCreate } from "./hooks";
import {
	appendTransactionRow,
	findIntentRow,
	findRowsByIntentId,
	hasRow,
	MOCK_CAPTURE_FAILURE_AMOUNT,
	MOCK_TRANSFER_FAILURE_AMOUNT,
} from "./paymentsShared";
import { handlePaymentWebhook } from "./paymentWebhook";

async function autoCallPaymentWebhook(
	db: EvyDb,
	paymentIntentId: string,
	events: PaymentWebhookRequest["type"][],
): Promise<void> {
	for (const type of events) {
		try {
			await handlePaymentWebhook(
				{ type, payment_intent_id: paymentIntentId },
				db,
			);
		} catch (error) {
			console.error(
				`payment webhook auto-call failed for ${type}:`,
				error,
			);
		}
	}
}

export async function paymentIntent(
	params: PaymentIntentRequest,
	db: EvyDb,
): Promise<PaymentIntentResponse> {
	const visibility = EVY_CORE_RESOURCE_VISIBILITY.transactions;
	if (!visibility) {
		throw new Error("evy.transactions has no declared visibility");
	}

	const created = (await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
		data: {
			fk: params.fk,
			resource: params.resource,
			type: "charge",
			status: "intent",
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
	})) as PaymentIntentResponse;

	await autoCallPaymentWebhook(db, created.payment_provider_transaction_id, [
		"payment_intent.succeeded",
	]);

	return validatePaymentIntentResponse(created);
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
	if (hasRow(rows, "charge", "initiated")) {
		throw new Error(
			`payment intent already captured: ${params.payment_intent_id}`,
		);
	}

	const created = (await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
		data: {
			fk: intent.fk,
			resource: intent.resource,
			type: "charge",
			status: "initiated",
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
	})) as PaymentCaptureResponse;

	if (intent.amount === MOCK_CAPTURE_FAILURE_AMOUNT) {
		await autoCallPaymentWebhook(
			db,
			intent.payment_provider_transaction_id,
			["payment_intent.capture_failed"],
		);
	} else {
		await autoCallPaymentWebhook(
			db,
			intent.payment_provider_transaction_id,
			["payment_intent.capture_succeeded", "charge.completed"],
		);
	}

	return validatePaymentCaptureResponse(created);
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
	if (!hasRow(rows, "charge", "succeeded")) {
		throw new Error(
			`payment charge not succeeded: ${params.payment_intent_id}`,
		);
	}
	if (hasRow(rows, "transfer", "initiated")) {
		throw new Error(
			`payment intent already transferred: ${params.payment_intent_id}`,
		);
	}

	const created = (await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
		data: {
			fk: intent.fk,
			resource: intent.resource,
			type: "transfer",
			status: "initiated",
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
	})) as PaymentTransferResponse;

	if (intent.amount === MOCK_TRANSFER_FAILURE_AMOUNT) {
		await autoCallPaymentWebhook(
			db,
			intent.payment_provider_transaction_id,
			["transfer.failed"],
		);
	} else {
		await autoCallPaymentWebhook(
			db,
			intent.payment_provider_transaction_id,
			["transfer.succeeded", "transfer.completed"],
		);
	}

	return validatePaymentTransferResponse(created);
}
