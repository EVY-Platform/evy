import { eq } from "drizzle-orm";
import type {
	DATA_EVY_Message,
	DATA_EVY_Transaction,
	PaymentWebhookRequest,
	PaymentWebhookResponse,
} from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_RESOURCE_VISIBILITY,
} from "evy-types/coreResources";
import { message } from "evy-types/db/schema.generated";
import { validatePaymentWebhookResponse } from "evy-types/validators";
import type { EvyDb } from "../database/db";
import { hookedCreate } from "./hooks";
import {
	appendTransactionRow,
	findIntentRow,
	findRowsByIntentId,
	hasRow,
} from "./paymentsShared";

type FailureMessageValue = "charge_failed" | "transfer_failed";

async function loadAuthorizationMessage(
	db: EvyDb,
	authorizationMessageId: string,
): Promise<DATA_EVY_Message | undefined> {
	const rows = await db
		.select()
		.from(message)
		.where(eq(message.id, authorizationMessageId));
	const row = rows.find((candidate) => candidate.deleted_at === null);
	return row as DATA_EVY_Message | undefined;
}

async function authorFailureMessage(
	db: EvyDb,
	intent: DATA_EVY_Transaction,
	value: FailureMessageValue,
): Promise<void> {
	const authorizationMessage = await loadAuthorizationMessage(
		db,
		intent.authorization_message_id,
	);
	if (!authorizationMessage) {
		throw new Error(
			`authorization message not found: ${intent.authorization_message_id}`,
		);
	}

	const visibility = EVY_CORE_RESOURCE_VISIBILITY.messages;
	if (!visibility) {
		throw new Error("evy.messages has no declared visibility");
	}

	const failureMessageData: Record<string, unknown> = {
		fk: authorizationMessage.fk,
		resource: authorizationMessage.resource,
		type: authorizationMessage.type,
		value,
		data: authorizationMessage.data ?? {},
		visibility,
	};
	if (typeof authorizationMessage.parent_message_id === "string") {
		failureMessageData.parent_message_id =
			authorizationMessage.parent_message_id;
	}

	await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.MESSAGES,
		data: failureMessageData,
	});
}

async function appendRowIfMissing(
	db: EvyDb,
	intent: DATA_EVY_Transaction,
	type: DATA_EVY_Transaction["type"],
	status: DATA_EVY_Transaction["status"],
	rows: DATA_EVY_Transaction[],
): Promise<void> {
	if (hasRow(rows, type, status)) {
		return;
	}
	await appendTransactionRow(db, intent, type, status);
}

export async function handlePaymentWebhook(
	params: PaymentWebhookRequest,
	db: EvyDb,
): Promise<PaymentWebhookResponse> {
	const rows = await findRowsByIntentId(db, params.payment_intent_id);
	const intent = findIntentRow(rows);

	switch (params.type) {
		case "payment_intent.succeeded": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			break;
		}
		case "payment_intent.payment_failed": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "charge", "failed", rows);
			await authorFailureMessage(db, intent, "charge_failed");
			break;
		}
		case "payment_intent.capture_succeeded": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			if (!hasRow(rows, "charge", "initiated")) {
				throw new Error(
					`capture not initiated for payment intent: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "charge", "succeeded", rows);
			break;
		}
		case "payment_intent.capture_failed": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			if (!hasRow(rows, "charge", "initiated")) {
				throw new Error(
					`capture not initiated for payment intent: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "charge", "failed", rows);
			await authorFailureMessage(db, intent, "charge_failed");
			break;
		}
		case "charge.completed": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			if (!hasRow(rows, "charge", "succeeded")) {
				throw new Error(
					`charge not succeeded for payment intent: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "charge", "completed", rows);
			break;
		}
		case "transfer.succeeded": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			if (!hasRow(rows, "transfer", "initiated")) {
				throw new Error(
					`transfer not initiated for payment intent: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "transfer", "succeeded", rows);
			break;
		}
		case "transfer.failed": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			if (!hasRow(rows, "transfer", "initiated")) {
				throw new Error(
					`transfer not initiated for payment intent: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "transfer", "failed", rows);
			await authorFailureMessage(db, intent, "transfer_failed");
			break;
		}
		case "transfer.completed": {
			if (!intent) {
				throw new Error(
					`payment intent not found: ${params.payment_intent_id}`,
				);
			}
			if (!hasRow(rows, "transfer", "succeeded")) {
				throw new Error(
					`transfer not succeeded for payment intent: ${params.payment_intent_id}`,
				);
			}
			await appendRowIfMissing(db, intent, "transfer", "completed", rows);
			break;
		}
	}

	return validatePaymentWebhookResponse({ received: true });
}
