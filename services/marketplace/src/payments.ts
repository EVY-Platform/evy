import { and, eq, isNull } from "drizzle-orm";
import type { DATA_EVY_Transaction } from "evy-types";

import { callCoreApi } from "./coreClient";
import { data, db } from "./db";
import {
	recordPaymentIntent,
	resolvePaymentIntentForMessage,
} from "./paymentIntents";
import type { MessagePayload } from "./purchase";
import { MARKETPLACE_RESOURCE } from "./resources";

export type PaymentAction =
	| "payment_intent"
	| "payment_capture"
	| "payment_transfer"
	| "payment_cancel"
	| "payment_capture_then_transfer"
	| "none";

type ValidationResult = { ok: true } | { ok: false; reason: string };

type ItemPrice = { amount: number; currency: string };

const NON_PAYMENT_VALUES = new Set([
	"charge_failed",
	"transfer_failed",
	"request_failed",
]);

export function paymentActionForMessage(
	type: string,
	value: string,
): PaymentAction {
	if (NON_PAYMENT_VALUES.has(value)) {
		return "none";
	}

	if (value === "pending" && (type === "delivery" || type === "shipping")) {
		return "payment_intent";
	}
	if (value === "transaction" && type === "pickup") {
		return "payment_intent";
	}
	if (value === "accept" && (type === "delivery" || type === "shipping")) {
		return "payment_capture";
	}
	if (value === "transaction_completed" && type === "pickup") {
		return "payment_capture_then_transfer";
	}
	if (value === "received" && (type === "delivery" || type === "shipping")) {
		return "payment_transfer";
	}
	if (
		value === "cancel" ||
		value === "transaction_rejected" ||
		(value === "reject" && (type === "delivery" || type === "shipping"))
	) {
		return "payment_cancel";
	}

	return "none";
}

async function loadItemPrice(itemId: string): Promise<ItemPrice | undefined> {
	const rows = await db
		.select({ data: data.data })
		.from(data)
		.where(
			and(
				eq(data.id, itemId),
				eq(data.resource, MARKETPLACE_RESOURCE.ITEMS),
				isNull(data.deleted_at),
			),
		)
		.limit(1);
	const item = rows[0]?.data as
		| { price?: { currency?: string; value?: number | string } }
		| undefined;
	if (!item?.price?.value) {
		return undefined;
	}
	const amount = Number(item.price.value);
	if (!Number.isFinite(amount) || amount <= 0) {
		return undefined;
	}
	return {
		amount,
		currency: item.price.currency ?? "AUD",
	};
}

function needsIntentValidation(action: PaymentAction): boolean {
	return action === "payment_intent";
}

function needsStoredIntentValidation(action: PaymentAction): boolean {
	return (
		action === "payment_capture" ||
		action === "payment_transfer" ||
		action === "payment_capture_then_transfer"
	);
}

export async function validatePaymentPreconditions(
	message: MessagePayload,
): Promise<ValidationResult> {
	const action = paymentActionForMessage(message.type, message.value);
	if (action === "none" || action === "payment_cancel") {
		return { ok: true };
	}

	if (needsIntentValidation(action)) {
		const price = await loadItemPrice(message.fk);
		if (!price) {
			return {
				ok: false,
				reason: "Item has no valid price for payment",
			};
		}
		return { ok: true };
	}

	if (needsStoredIntentValidation(action)) {
		const stored = await resolvePaymentIntentForMessage(message);
		if (!stored) {
			return {
				ok: false,
				reason: "No payment intent found for this purchase",
			};
		}
	}

	return { ok: true };
}

async function runPaymentIntent(
	message: MessagePayload,
	price: ItemPrice,
): Promise<void> {
	if (!message.id) {
		throw new Error("payment_intent requires message id");
	}
	const response = (await callCoreApi("payment_intent", {
		fk: message.fk,
		resource: message.resource ?? MARKETPLACE_RESOURCE.ITEMS,
		amount: price.amount,
		currency: price.currency,
		authorization_message_id: message.id,
	})) as DATA_EVY_Transaction;

	await recordPaymentIntent({
		itemId: message.fk,
		authorizationMessageId: message.id,
		paymentIntentId: response.payment_provider_transaction_id,
	});
}

async function runPaymentCapture(paymentIntentId: string): Promise<void> {
	await callCoreApi("payment_capture", {
		payment_intent_id: paymentIntentId,
	});
}

async function runPaymentTransfer(paymentIntentId: string): Promise<void> {
	await callCoreApi("payment_transfer", {
		payment_intent_id: paymentIntentId,
	});
}

async function runPaymentCancel(paymentIntentId: string): Promise<void> {
	await callCoreApi("payment_cancel", {
		payment_intent_id: paymentIntentId,
	});
}

export async function runPaymentReaction(
	message: MessagePayload,
): Promise<void> {
	const action = paymentActionForMessage(message.type, message.value);
	if (action === "none") {
		return;
	}

	try {
		if (action === "payment_intent") {
			const price = await loadItemPrice(message.fk);
			if (!price) {
				console.error(
					`[marketplace] payment_intent skipped: no valid price for item ${message.fk}`,
				);
				return;
			}
			await runPaymentIntent(message, price);
			return;
		}

		if (action === "payment_cancel") {
			const stored = await resolvePaymentIntentForMessage(message);
			if (!stored) {
				return;
			}
			await runPaymentCancel(stored.payment_intent_id);
			return;
		}

		const stored = await resolvePaymentIntentForMessage(message);
		if (!stored) {
			console.error(
				`[marketplace] ${action} skipped: no payment intent for item ${message.fk}`,
			);
			return;
		}

		if (action === "payment_capture") {
			await runPaymentCapture(stored.payment_intent_id);
			return;
		}

		if (action === "payment_transfer") {
			await runPaymentTransfer(stored.payment_intent_id);
			return;
		}

		if (action === "payment_capture_then_transfer") {
			try {
				await runPaymentCapture(stored.payment_intent_id);
			} catch (error) {
				console.error(
					`[marketplace] payment_capture failed for item ${message.fk}:`,
					error,
				);
				return;
			}
			try {
				await runPaymentTransfer(stored.payment_intent_id);
			} catch (error) {
				console.error(
					`[marketplace] payment_transfer failed for item ${message.fk}:`,
					error,
				);
			}
		}
	} catch (error) {
		console.error(
			`[marketplace] payment reaction failed for item ${message.fk} (${action}):`,
			error,
		);
	}
}
