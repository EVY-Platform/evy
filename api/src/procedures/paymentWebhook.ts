import { and, eq, isNull } from "drizzle-orm";
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
import type { EvyDb } from "../database/db";
import { hookedCreate } from "./hooks";
import {
	appendTransactionRow,
	derivedMessageData,
	hasRow,
	requireIntent,
} from "./paymentsShared";

type FailureMessageValue = "charge_failed" | "transfer_failed";

type WebhookHandler = {
	requires?: {
		type: DATA_EVY_Transaction["type"];
		status: DATA_EVY_Transaction["status"];
		error: string;
	};
	append?: {
		type: DATA_EVY_Transaction["type"];
		status: DATA_EVY_Transaction["status"];
	};
	failure?: FailureMessageValue;
};

const WEBHOOK_HANDLERS: Record<PaymentWebhookRequest["type"], WebhookHandler> =
	{
		"payment_intent.succeeded": {},
		"payment_intent.capture_succeeded": {
			requires: {
				type: "charge",
				status: "initiated",
				error: "capture not initiated for payment intent",
			},
			append: { type: "charge", status: "succeeded" },
		},
		"payment_intent.capture_failed": {
			requires: {
				type: "charge",
				status: "initiated",
				error: "capture not initiated for payment intent",
			},
			append: { type: "charge", status: "failed" },
			failure: "charge_failed",
		},
		"charge.completed": {
			requires: {
				type: "charge",
				status: "succeeded",
				error: "charge not succeeded for payment intent",
			},
			append: { type: "charge", status: "completed" },
		},
		"transfer.succeeded": {
			requires: {
				type: "transfer",
				status: "initiated",
				error: "transfer not initiated for payment intent",
			},
			append: { type: "transfer", status: "succeeded" },
		},
		"transfer.failed": {
			requires: {
				type: "transfer",
				status: "initiated",
				error: "transfer not initiated for payment intent",
			},
			append: { type: "transfer", status: "failed" },
			failure: "transfer_failed",
		},
		"transfer.completed": {
			requires: {
				type: "transfer",
				status: "succeeded",
				error: "transfer not succeeded for payment intent",
			},
			append: { type: "transfer", status: "completed" },
		},
	};

async function loadAuthorizationMessage(
	db: EvyDb,
	authorizationMessageId: string,
): Promise<DATA_EVY_Message | undefined> {
	const rows = await db
		.select()
		.from(message)
		.where(
			and(
				eq(message.id, authorizationMessageId),
				isNull(message.deleted_at),
			),
		);
	return rows[0] as DATA_EVY_Message | undefined;
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

	await hookedCreate(db, {
		resource: EVY_CORE_RESOURCE_REF.MESSAGES,
		data: derivedMessageData(authorizationMessage, {
			value,
			data: authorizationMessage.data ?? {},
			visibility: EVY_CORE_RESOURCE_VISIBILITY.messages,
		}),
	});
}

export async function handlePaymentWebhook(
	params: PaymentWebhookRequest,
	db: EvyDb,
): Promise<PaymentWebhookResponse> {
	const { rows, intent } = await requireIntent(db, params.payment_intent_id);

	const handler = WEBHOOK_HANDLERS[params.type];
	if (handler.requires) {
		const { type, status, error } = handler.requires;
		if (!hasRow(rows, type, status)) {
			throw new Error(`${error}: ${params.payment_intent_id}`);
		}
	}
	if (handler.append) {
		const { type, status } = handler.append;
		if (!hasRow(rows, type, status)) {
			await appendTransactionRow(db, intent, type, status);
		}
	}
	if (handler.failure) {
		await authorFailureMessage(db, intent, handler.failure);
	}

	return { received: true };
}
