import { desc, eq } from "drizzle-orm";
import { nowIso as clockNowIso } from "evy-types/clock";

import { db, item_payment_intents } from "./db";

export type ItemPaymentIntent = typeof item_payment_intents.$inferSelect;

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

export async function findLatestIntentForItem(
	itemId: string,
): Promise<ItemPaymentIntent | undefined> {
	const rows = await db
		.select()
		.from(item_payment_intents)
		.where(eq(item_payment_intents.item_id, itemId))
		.orderBy(
			desc(item_payment_intents.created_at),
			desc(item_payment_intents.id),
		)
		.limit(1);
	return rows[0];
}

export async function resolvePaymentIntentForMessage(message: {
	fk: string;
	parent_message_id?: string;
}): Promise<ItemPaymentIntent | undefined> {
	if (message.parent_message_id) {
		return findIntentByAuthorizationMessageId(message.parent_message_id);
	}
	console.error(
		`[marketplace] payment intent lookup missing parent_message_id for item ${message.fk}; falling back to latest intent`,
	);
	return findLatestIntentForItem(message.fk);
}
