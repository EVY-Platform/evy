import { eq } from "drizzle-orm";
import { nowIso as clockNowIso } from "evy-types/clock";

import { db, item_payment_intents } from "./db";

type ItemPaymentIntent = typeof item_payment_intents.$inferSelect;

export async function recordPaymentIntent(params: {
	itemId: string;
	authorizationMessageId: string;
	paymentIntentId: string;
}): Promise<ItemPaymentIntent> {
	const created_at = clockNowIso();
	const rows = await db
		.insert(item_payment_intents)
		.values({
			item_id: params.itemId,
			authorization_message_id: params.authorizationMessageId,
			payment_intent_id: params.paymentIntentId,
			created_at,
		})
		.returning();
	return rows[0];
}

export async function findIntentByAuthorizationMessageId(
	authorizationMessageId: string,
): Promise<ItemPaymentIntent | undefined> {
	const rows = await db
		.select()
		.from(item_payment_intents)
		.where(
			eq(
				item_payment_intents.authorization_message_id,
				authorizationMessageId,
			),
		)
		.limit(1);
	return rows[0];
}

export async function resolvePaymentIntentForMessage(message: {
	parent_message_id?: string;
}): Promise<ItemPaymentIntent | undefined> {
	if (!message.parent_message_id) {
		return undefined;
	}
	return findIntentByAuthorizationMessageId(message.parent_message_id);
}

/**
 * Purchase threads reply linearly (pending ← accept ← given ← received), but
 * the intent row is keyed to the message that authorized it. Aliasing the
 * intent onto every later message in the thread keeps resolution a single
 * parent hop no matter how deep the reply chain grows.
 */
export async function extendIntentToMessage(message: {
	id?: string;
	fk: string;
	parent_message_id?: string;
}): Promise<void> {
	if (!message.id || !message.parent_message_id) {
		return;
	}
	if (await findIntentByAuthorizationMessageId(message.id)) {
		return;
	}
	const stored = await findIntentByAuthorizationMessageId(
		message.parent_message_id,
	);
	if (!stored) {
		return;
	}
	await recordPaymentIntent({
		itemId: message.fk,
		authorizationMessageId: message.id,
		paymentIntentId: stored.payment_intent_id,
	});
}
