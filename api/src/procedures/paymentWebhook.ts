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
	findIntentRow,
	findRowsByIntentId,
	hasRow,
} from "./paymentsShared";

type FailureMessageValue = "charge_failed" | "transfer_failed";

type WebhookHandler = {
	requires?: (rows: DATA_EVY_Transaction[], paymentIntentId: string) => void;
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
			requires: (rows, paymentIntentId) => {
				if (!hasRow(rows, "charge", "initiated")) {
					throw new Error(
						`capture not initiated for payment intent: ${paymentIntentId}`,
					);
				}
			},
			append: { type: "charge", status: "succeeded" },
		},
		"payment_intent.capture_failed": {
			requires: (rows, paymentIntentId) => {
				if (!hasRow(rows, "charge", "initiated")) {
					throw new Error(
						`capture not initiated for payment intent: ${paymentIntentId}`,
					);
				}
			},
			append: { type: "charge", status: "failed" },
			failure: "charge_failed",
		},
		"charge.completed": {
			requires: (rows, paymentIntentId) => {
				if (!hasRow(rows, "charge", "succeeded")) {
					throw new Error(
						`charge not succeeded for payment intent: ${paymentIntentId}`,
					);
				}
			},
			append: { type: "charge", status: "completed" },
		},
		"transfer.succeeded": {
			requires: (rows, paymentIntentId) => {
				if (!hasRow(rows, "transfer", "initiated")) {
					throw new Error(
						`transfer not initiated for payment intent: ${paymentIntentId}`,
					);
				}
			},
			append: { type: "transfer", status: "succeeded" },
		},
		"transfer.failed": {
			requires: (rows, paymentIntentId) => {
				if (!hasRow(rows, "transfer", "initiated")) {
					throw new Error(
						`transfer not initiated for payment intent: ${paymentIntentId}`,
					);
				}
			},
			append: { type: "transfer", status: "failed" },
			failure: "transfer_failed",
		},
		"transfer.completed": {
			requires: (rows, paymentIntentId) => {
				if (!hasRow(rows, "transfer", "succeeded")) {
					throw new Error(
						`transfer not succeeded for payment intent: ${paymentIntentId}`,
					);
				}
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

	const failureMessageData: Record<string, unknown> = {
		fk: authorizationMessage.fk,
		resource: authorizationMessage.resource,
		type: authorizationMessage.type,
		value,
		data: authorizationMessage.data ?? {},
		visibility: EVY_CORE_RESOURCE_VISIBILITY.messages,
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
	if (!intent) {
		throw new Error(
			`payment intent not found: ${params.payment_intent_id}`,
		);
	}

	const handler = WEBHOOK_HANDLERS[params.type];
	if (handler.requires) {
		handler.requires(rows, params.payment_intent_id);
	}
	if (handler.append) {
		await appendRowIfMissing(
			db,
			intent,
			handler.append.type,
			handler.append.status,
			rows,
		);
	}
	if (handler.failure) {
		await authorFailureMessage(db, intent, handler.failure);
	}

	return { received: true };
}
