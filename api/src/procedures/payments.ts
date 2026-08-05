import type {
	PaymentCaptureRequest,
	PaymentCaptureResponse,
	PaymentIntentRequest,
	PaymentIntentResponse,
	PaymentTransferRequest,
	PaymentTransferResponse,
	PaymentWebhookRequest,
} from "evy-types";
import type { EvyDb } from "../database/db";
import { appendTransactionRow, hasRow, requireIntent } from "./paymentsShared";
import { handlePaymentWebhook } from "./paymentWebhook";
import { getStripeGateway } from "./stripeGateway";

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
	const { id: paymentProviderTransactionId } =
		await getStripeGateway().createPaymentIntent({
			amount: params.amount,
			currency: params.currency,
			metadata: {
				fk: params.fk,
				resource: params.resource,
				authorization_message_id: params.authorization_message_id,
			},
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
	await autoCallPaymentWebhook(db, params.payment_intent_id, captureEvents);

	return created;
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

	const outcome =
		intent.amount === 0
			? { ok: true as const }
			: await getStripeGateway().createTransfer({
					paymentIntentId: params.payment_intent_id,
					amount: intent.amount,
					currency: intent.currency,
					metadata: {
						fk: intent.fk,
						resource: intent.resource,
						authorization_message_id:
							intent.authorization_message_id,
					},
				});

	const transferEvents: PaymentWebhookRequest["type"][] = outcome.ok
		? ["transfer.succeeded", "transfer.completed"]
		: ["transfer.failed"];
	await autoCallPaymentWebhook(db, params.payment_intent_id, transferEvents);

	return created;
}
