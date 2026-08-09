import type {
	PaymentCancelRequest,
	PaymentCancelResponse,
	PaymentCaptureRequest,
	PaymentCaptureResponse,
	PaymentIntentRequest,
	PaymentIntentResponse,
	PaymentTransferRequest,
	PaymentTransferResponse,
	PaymentWebhookRequest,
} from "evy-types";
import { verifyTransactionSignature } from "evy-types/paymentSignature";
import type { EvyDb } from "../database/db";
import {
	appendTransactionRow,
	hasRow,
	paymentMetadata,
	paymentWebhookRequest,
	requireIntent,
} from "./paymentsShared";
import { handlePaymentWebhook } from "./paymentWebhook";
import { getStripeGateway } from "./stripeGateway";

async function autoCallPaymentWebhook(
	db: EvyDb,
	paymentIntentId: string,
	events: PaymentWebhookRequest["type"][],
	error?: string,
): Promise<void> {
	for (const type of events) {
		try {
			await handlePaymentWebhook(
				paymentWebhookRequest(type, paymentIntentId, error),
				db,
			);
		} catch (webhookError) {
			console.error(
				`payment webhook auto-call failed for ${type} (intent ${paymentIntentId}):`,
				webhookError,
			);
		}
	}
}

export async function paymentIntent(
	params: PaymentIntentRequest,
	db: EvyDb,
): Promise<PaymentIntentResponse> {
	const gateway = getStripeGateway();
	const last4 = await gateway.getPaymentMethodLast4();
	const verification = verifyTransactionSignature(
		params.signature,
		{
			amount: params.amount,
			currency: params.currency,
			authorization_message_id: params.authorization_message_id,
		},
		last4,
	);
	if (!verification.ok) {
		throw new Error(`invalid payment signature: ${verification.reason}`);
	}

	const { id: paymentProviderTransactionId } =
		await gateway.createPaymentIntent({
			amount: params.amount,
			currency: params.currency,
			metadata: paymentMetadata(params),
		});

	return appendTransactionRow(
		db,
		{
			fk: params.fk,
			resource: params.resource,
			amount: params.amount,
			currency: params.currency,
			payment_provider_transaction_id: paymentProviderTransactionId,
			authorization_message_id: params.authorization_message_id,
			signature: params.signature,
		},
		"charge",
		"intent",
	);
}

export async function paymentCapture(
	params: PaymentCaptureRequest,
	db: EvyDb,
): Promise<PaymentCaptureResponse> {
	const { rows, intent } = await requireIntent(db, params.payment_intent_id);
	if (hasRow(rows, "charge", "canceled")) {
		throw new Error(`payment intent canceled: ${params.payment_intent_id}`);
	}
	if (hasRow(rows, "charge", "initiated")) {
		throw new Error(
			`payment intent already captured: ${params.payment_intent_id}`,
		);
	}

	const created = await appendTransactionRow(
		db,
		intent,
		"charge",
		"initiated",
	);

	const outcome = await getStripeGateway().capturePaymentIntent(
		params.payment_intent_id,
		intent.amount,
	);

	const captureEvents: PaymentWebhookRequest["type"][] = outcome.ok
		? ["payment_intent.capture_succeeded", "charge.completed"]
		: ["payment_intent.capture_failed"];
	await autoCallPaymentWebhook(
		db,
		params.payment_intent_id,
		captureEvents,
		outcome.ok ? undefined : outcome.reason,
	);

	return created;
}

export async function paymentCancel(
	params: PaymentCancelRequest,
	db: EvyDb,
): Promise<PaymentCancelResponse> {
	const { rows, intent } = await requireIntent(db, params.payment_intent_id);
	const canceled = rows.find(
		(row) => row.type === "charge" && row.status === "canceled",
	);
	if (canceled) {
		return canceled;
	}
	if (hasRow(rows, "charge", "initiated")) {
		throw new Error(
			`payment intent already captured: ${params.payment_intent_id}`,
		);
	}

	const outcome = await getStripeGateway().cancelPaymentIntent(
		params.payment_intent_id,
	);
	if (!outcome.ok) {
		throw new Error(outcome.reason);
	}

	return appendTransactionRow(db, intent, "charge", "canceled");
}

export async function paymentTransfer(
	params: PaymentTransferRequest,
	db: EvyDb,
): Promise<PaymentTransferResponse> {
	const { rows, intent } = await requireIntent(db, params.payment_intent_id);
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

	const created = await appendTransactionRow(
		db,
		intent,
		"transfer",
		"initiated",
	);

	const outcome = await getStripeGateway().createTransfer({
		paymentIntentId: params.payment_intent_id,
		amount: intent.amount,
		currency: intent.currency,
		metadata: paymentMetadata(intent),
	});

	const transferEvents: PaymentWebhookRequest["type"][] = outcome.ok
		? ["transfer.succeeded", "transfer.completed"]
		: ["transfer.failed"];
	await autoCallPaymentWebhook(
		db,
		params.payment_intent_id,
		transferEvents,
		outcome.ok ? undefined : outcome.reason,
	);

	return created;
}
