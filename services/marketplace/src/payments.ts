import { and, eq, isNull } from "drizzle-orm";
import type { DATA_EVY_Transaction } from "evy-types";

import { callCoreApi } from "./coreClient";
import { data, db } from "./db";
import {
	recordPaymentIntent,
	resolvePaymentIntentForMessage,
} from "./paymentIntents";
import type { MessagePayload, ValidationResult } from "./purchase";
import { MARKETPLACE_RESOURCE } from "./resources";

type PaymentAction =
	| "payment_intent"
	| "payment_capture"
	| "payment_transfer"
	| "payment_cancel"
	| "payment_capture_then_transfer"
	| "none";

type ItemPrice = { amount: number; currency: string };

type MessageSignature = {
	data: unknown;
	hash: unknown;
};

export function paymentActionForMessage(
	type: string,
	value: string,
): PaymentAction {
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

function signatureFromMessage(
	message: MessagePayload,
): MessageSignature | undefined {
	const signature = message.data.signature;
	if (
		signature === null ||
		typeof signature !== "object" ||
		Array.isArray(signature)
	) {
		return undefined;
	}
	const record = signature as Record<string, unknown>;
	if (!("data" in record) || !("hash" in record)) {
		return undefined;
	}
	return { data: record.data, hash: record.hash };
}

export async function validatePaymentPreconditions(
	message: MessagePayload,
): Promise<ValidationResult> {
	const action = paymentActionForMessage(message.type, message.value);
	if (action === "none" || action === "payment_cancel") {
		return { ok: true };
	}

	if (action === "payment_intent") {
		const price = await loadItemPrice(message.fk);
		if (!price) {
			return {
				ok: false,
				reason: "Item has no valid price for payment",
			};
		}
		if (!signatureFromMessage(message)) {
			return {
				ok: false,
				reason: "Missing payment signature",
			};
		}
		return { ok: true };
	}

	// capture, transfer, and capture_then_transfer all act on a stored intent
	const stored = await resolvePaymentIntentForMessage(message);
	if (!stored) {
		return {
			ok: false,
			reason: "No payment intent found for this purchase",
		};
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
	const signature = signatureFromMessage(message);
	if (!signature) {
		throw new Error("payment_intent requires message data.signature");
	}
	const response = (await callCoreApi("payment_intent", {
		fk: message.fk,
		resource: message.resource,
		amount: price.amount,
		currency: price.currency,
		authorization_message_id: message.id,
		signature,
	})) as DATA_EVY_Transaction;

	await recordPaymentIntent({
		itemId: message.fk,
		authorizationMessageId: message.id,
		paymentIntentId: response.payment_provider_transaction_id,
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

		const stored = await resolvePaymentIntentForMessage(message);
		if (!stored) {
			// Canceling a request that never got an intent is normal.
			if (action !== "payment_cancel") {
				console.error(
					`[marketplace] ${action} skipped: no payment intent for item ${message.fk}`,
				);
			}
			return;
		}
		const params = { payment_intent_id: stored.payment_intent_id };

		if (action === "payment_capture_then_transfer") {
			try {
				await callCoreApi("payment_capture", params);
			} catch (error) {
				console.error(
					`[marketplace] payment_capture failed for item ${message.fk}:`,
					error,
				);
				return;
			}
			await callCoreApi("payment_transfer", params);
			return;
		}

		await callCoreApi(action, params);
	} catch (error) {
		console.error(
			`[marketplace] payment reaction failed for item ${message.fk} (${action}):`,
			error,
		);
	}
}
