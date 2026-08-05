import type { DATA_EVY_Message, DATA_EVY_Transaction } from "evy-types";
import { EVY_MESSAGE_DATA_VALUES } from "evy-types/coreResources";

import { appendStatus, currentStatus, type ItemStatus } from "./status";

// before_create hook payloads carry no id yet, so it stays optional here.
export type MessagePayload = Pick<
	DATA_EVY_Message,
	"fk" | "type" | "value" | "parent_message_id" | "resource"
> & { id?: string };

export type TransactionPayload = Pick<
	DATA_EVY_Transaction,
	"fk" | "type" | "status"
>;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const PICKUP_HANDSHAKE_VALUES = new Set([
	"transaction",
	"transaction_completed",
	"transaction_rejected",
]);

const FULFILLMENT_VALUES = new Set(["given", "sent", "received", "failed"]);

const KNOWN_VALUES = new Set<string>(EVY_MESSAGE_DATA_VALUES);

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

function rejectWrongStatus(
	value: string,
	status: ItemStatus,
): ValidationResult {
	return {
		ok: false,
		reason: `Cannot send "${value}" while item status is "${status}"`,
	};
}

function validateAllowedStatus(
	value: string,
	status: ItemStatus,
): ValidationResult {
	switch (value) {
		case "pending":
			return status === "available"
				? { ok: true }
				: rejectWrongStatus(value, status);
		case "accept":
			return status === "available" || status === "sold"
				? { ok: true }
				: rejectWrongStatus(value, status);
		default:
			break;
	}
	if (PICKUP_HANDSHAKE_VALUES.has(value)) {
		return status === "pickup_pending" || status === "sold"
			? { ok: true }
			: rejectWrongStatus(value, status);
	}
	if (FULFILLMENT_VALUES.has(value)) {
		return status === "sold"
			? { ok: true }
			: rejectWrongStatus(value, status);
	}
	return { ok: true };
}

function shouldRollback(value: string, status: ItemStatus): boolean {
	if (status === "available") {
		return false;
	}
	switch (value) {
		case "cancel":
			return status !== "sold";
		case "transaction_rejected":
			return status === "pickup_pending" || status === "sold";
		case "charge_failed":
			return PENDING_STATUSES.has(status) || status === "sold";
		case "failed":
		case "transfer_failed":
			return status === "sold";
		default:
			return false;
	}
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
	return validateAllowedStatus(value, status);
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

	if (shouldRollback(value, status)) {
		await appendStatus(itemId, "available");
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
): Promise<void> {
	const previous = itemQueues.get(itemId) ?? Promise.resolve();
	const next = previous
		.catch(() => {})
		.then(work)
		.catch((error: unknown) => {
			console.error(
				`[marketplace] purchase reaction failed for item ${itemId}:`,
				error,
			);
		});
	itemQueues.set(itemId, next);
	return next;
}

export function enqueuePurchaseReaction(message: MessagePayload): void {
	void enqueueItemReaction(message.fk, () => reactToPurchaseMessage(message));
}

export function enqueueTransactionReaction(
	transaction: TransactionPayload,
): void {
	void enqueueItemReaction(transaction.fk, () =>
		reactToTransaction(transaction),
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
