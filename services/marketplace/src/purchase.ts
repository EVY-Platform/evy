import type { DATA_EVY_Message } from "evy-types";

import { appendStatus, currentStatus, type ItemStatus } from "./status";

type MessagePayload = Pick<
	DATA_EVY_Message,
	"fk" | "type" | "value" | "parent_message_id"
>;

type ValidationResult = { ok: true } | { ok: false; reason: string };

const PAYMENT_VALUES = new Set([
	"charge_initiated",
	"charge_failed",
	"charge_completed",
	"transfer_initiated",
	"transfer_failed",
	"transfer_completed",
]);

const PICKUP_HANDSHAKE_VALUES = new Set([
	"transaction",
	"transaction_completed",
	"transaction_rejected",
	"transaction_failed",
]);

const FULFILLMENT_VALUES = new Set([
	"given",
	"given_failed",
	"sent",
	"sent_failed",
	"received",
	"reception_failed",
	"failed",
]);

const ROLLBACK_VALUES = new Set([
	"transaction_rejected",
	"transaction_failed",
	"given_failed",
	"sent_failed",
	"reception_failed",
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
	...PICKUP_HANDSHAKE_VALUES,
	...FULFILLMENT_VALUES,
	...PAYMENT_VALUES,
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
	if (
		(value === "given" || value === "given_failed") &&
		type !== "delivery"
	) {
		return `"${value}" is only valid on delivery chains`;
	}
	if ((value === "sent" || value === "sent_failed") && type !== "shipping") {
		return `"${value}" is only valid on shipping chains`;
	}
	if (value === "reception_failed" && type !== "delivery") {
		return `"reception_failed" is only valid on delivery chains`;
	}
	if (value === "failed" && type !== "shipping") {
		return `"failed" is only valid on shipping chains`;
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

	const typeValueError = validateTypeValuePair(type, value);
	if (typeValueError) {
		return { ok: false, reason: typeValueError };
	}

	if (PAYMENT_VALUES.has(value)) {
		return { ok: true };
	}

	const status = await currentStatus(itemId);

	if (value === "pending" || value === "accept") {
		if (status !== "available") {
			return {
				ok: false,
				reason: `Cannot send "${value}" while item status is "${status}"`,
			};
		}
		return { ok: true };
	}

	if (PICKUP_HANDSHAKE_VALUES.has(value)) {
		if (status !== "pickup_pending") {
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

async function reactToMessage(message: MessagePayload): Promise<void> {
	const { fk: itemId, type, value } = message;
	const status = await currentStatus(itemId);

	if (value === "accept") {
		const pendingStatus = pendingStatusForType(type);
		if (pendingStatus && status !== pendingStatus) {
			await appendStatus(itemId, pendingStatus);
		}
		return;
	}

	if (value === "charge_initiated") {
		if (status !== "sold") {
			await appendStatus(itemId, "sold");
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
			(value === "transaction_rejected" ||
				value === "transaction_failed") &&
			status !== "pickup_pending"
		) {
			return;
		}
		if (
			(value === "charge_failed" || value === "cancel") &&
			!PENDING_STATUSES.has(status)
		) {
			return;
		}
		if (
			(value === "given_failed" ||
				value === "sent_failed" ||
				value === "reception_failed" ||
				value === "failed" ||
				value === "transfer_failed") &&
			status !== "sold"
		) {
			return;
		}
		if (status !== "available") {
			await appendStatus(itemId, "available");
		}
	}
}

const itemQueues = new Map<string, Promise<void>>();

function enqueueItemReaction(
	itemId: string,
	work: () => Promise<void>,
): Promise<void> {
	const previous = itemQueues.get(itemId) ?? Promise.resolve();
	const next = previous.then(work).catch((error: unknown) => {
		console.error(
			`[marketplace] purchase reaction failed for item ${itemId}:`,
			error,
		);
	});
	itemQueues.set(itemId, next);
	return next;
}

export function enqueuePurchaseReaction(message: MessagePayload): void {
	void enqueueItemReaction(message.fk, () => reactToMessage(message));
}

/** Awaits the reaction — for tests and other callers that need a settled status. */
export function awaitPurchaseReaction(message: MessagePayload): Promise<void> {
	return enqueueItemReaction(message.fk, () => reactToMessage(message));
}

/** Visible for tests — drains every per-item queue. */
export async function drainPurchaseQueues(): Promise<void> {
	const pending = [...itemQueues.values()];
	itemQueues.clear();
	await Promise.all(pending);
}
