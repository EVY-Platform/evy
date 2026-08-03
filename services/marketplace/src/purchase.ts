import type { DATA_EVY_Message, DATA_EVY_Transaction } from "evy-types";

import { appendStatus, currentStatus, type ItemStatus } from "./status";

type MessagePayload = Pick<
	DATA_EVY_Message,
	"fk" | "type" | "value" | "parent_message_id"
>;

type TransactionPayload = Pick<
	DATA_EVY_Transaction,
	"fk" | "resource" | "type" | "status"
>;

type ValidationResult = { ok: true } | { ok: false; reason: string };

const PICKUP_HANDSHAKE_VALUES = new Set([
	"transaction",
	"transaction_completed",
	"transaction_rejected",
]);

const FULFILLMENT_VALUES = new Set(["given", "sent", "received", "failed"]);

const ROLLBACK_VALUES = new Set([
	"transaction_rejected",
	"failed",
	"charge_failed",
	"transfer_failed",
	"cancel",
]);

const KNOWN_VALUES = new Set([
	"pending",
	"accept",
	"reject",
	"cancel",
	"request_failed",
	...PICKUP_HANDSHAKE_VALUES,
	...FULFILLMENT_VALUES,
	"charge_failed",
	"transfer_failed",
]);

const PENDING_STATUSES = new Set<ItemStatus>([
	"pickup_pending",
	"delivery_pending",
	"shipping_pending",
]);

function pendingStatusForType(type: string): ItemStatus | null {
	switch (type) {
		case "pickup":
			return "pickup_pending";
		case "delivery":
			return "delivery_pending";
		case "shipping":
			return "shipping_pending";
		default:
			return null;
	}
}

function validateTypeValuePair(type: string, value: string): string | null {
	if (!KNOWN_VALUES.has(value)) {
		return `Unknown message value "${value}"`;
	}

	if (PICKUP_HANDSHAKE_VALUES.has(value) && type !== "pickup") {
		return `"${value}" is only valid on pickup chains`;
	}
	if (value === "given" && type !== "delivery") {
		return `"${value}" is only valid on delivery chains`;
	}
	if (value === "sent" && type !== "shipping") {
		return `"${value}" is only valid on shipping chains`;
	}
	if (value === "failed" && type !== "delivery" && type !== "shipping") {
		return `"${value}" is only valid on delivery or shipping chains`;
	}
	if (value === "received" && type !== "delivery" && type !== "shipping") {
		return `"received" is only valid on delivery or shipping chains`;
	}

	return null;
}

export async function validatePurchaseMessage(
	message: MessagePayload,
): Promise<ValidationResult> {
	const { fk: itemId, type, value } = message;

	if (value === "request_failed") {
		return { ok: true };
	}

	const typeValueError = validateTypeValuePair(type, value);
	if (typeValueError) {
		return { ok: false, reason: typeValueError };
	}

	const status = await currentStatus(itemId);

	if (value === "pending") {
		if (status !== "available") {
			return {
				ok: false,
				reason: `Cannot send "${value}" while item status is "${status}"`,
			};
		}
		return { ok: true };
	}

	if (value === "accept") {
		if (status !== "available" && status !== "sold") {
			return {
				ok: false,
				reason: `Cannot send "${value}" while item status is "${status}"`,
			};
		}
		return { ok: true };
	}

	if (PICKUP_HANDSHAKE_VALUES.has(value)) {
		if (status !== "pickup_pending" && status !== "sold") {
			return {
				ok: false,
				reason: `Cannot send "${value}" while item status is "${status}"`,
			};
		}
		return { ok: true };
	}

	if (FULFILLMENT_VALUES.has(value)) {
		if (status !== "sold") {
			return {
				ok: false,
				reason: `Cannot send "${value}" while item status is "${status}"`,
			};
		}
		return { ok: true };
	}

	return { ok: true };
}

export async function reactToPurchaseMessage(
	message: MessagePayload,
): Promise<void> {
	const { fk: itemId, type, value } = message;
	const status = await currentStatus(itemId);

	if (value === "accept") {
		const pendingStatus = pendingStatusForType(type);
		if (pendingStatus && status === "available") {
			await appendStatus(itemId, pendingStatus);
		}
		return;
	}

	if (ROLLBACK_VALUES.has(value)) {
		if (status === "available") {
			return;
		}
		if (value === "cancel" && status === "sold") {
			return;
		}
		if (
			value === "transaction_rejected" &&
			status !== "pickup_pending" &&
			status !== "sold"
		) {
			return;
		}
		if (
			(value === "charge_failed" || value === "cancel") &&
			!PENDING_STATUSES.has(status) &&
			status !== "sold"
		) {
			return;
		}
		if (
			(value === "failed" || value === "transfer_failed") &&
			status !== "sold"
		) {
			return;
		}
		if (status !== "available") {
			await appendStatus(itemId, "available");
		}
	}
}

export async function reactToTransaction(
	transaction: TransactionPayload,
): Promise<void> {
	if (transaction.type === "charge" && transaction.status === "succeeded") {
		const status = await currentStatus(transaction.fk);
		if (status !== "sold") {
			await appendStatus(transaction.fk, "sold");
		}
	}
}

const itemQueues = new Map<string, Promise<void>>();

function enqueueItemReaction(
	itemId: string,
	work: () => Promise<void>,
	swallowErrors: boolean,
): Promise<void> {
	const previous = itemQueues.get(itemId) ?? Promise.resolve();
	let next = previous.catch(() => {}).then(work);
	if (swallowErrors) {
		next = next.catch((error: unknown) => {
			console.error(
				`[marketplace] purchase reaction failed for item ${itemId}:`,
				error,
			);
		});
	}
	itemQueues.set(itemId, next);
	return next;
}

export function enqueuePurchaseReaction(message: MessagePayload): void {
	void enqueueItemReaction(
		message.fk,
		() => reactToPurchaseMessage(message),
		true,
	);
}

export function enqueueTransactionReaction(
	transaction: TransactionPayload,
): void {
	void enqueueItemReaction(
		transaction.fk,
		() => reactToTransaction(transaction),
		true,
	);
}

/** Awaits the reaction — for callers that need a settled status after enqueue. */
export function awaitPurchaseReaction(message: MessagePayload): Promise<void> {
	return enqueueItemReaction(
		message.fk,
		() => reactToPurchaseMessage(message),
		false,
	);
}

export function awaitTransactionReaction(
	transaction: TransactionPayload,
): Promise<void> {
	return enqueueItemReaction(
		transaction.fk,
		() => reactToTransaction(transaction),
		false,
	);
}

/** Visible for tests — drains every per-item queue. */
export async function drainPurchaseQueues(): Promise<void> {
	while (itemQueues.size > 0) {
		const pending = [...itemQueues.values()];
		itemQueues.clear();
		await Promise.all(pending);
	}
}
