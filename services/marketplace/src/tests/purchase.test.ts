import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

import { db, schema } from "../db";
import {
	drainPurchaseQueues,
	reactToPurchaseMessage,
	reactToTransaction,
	validatePurchaseMessage,
} from "../purchase";
import { appendStatus, currentStatus } from "../status";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
});

const itemId = () => crypto.randomUUID();

function message(overrides: Record<string, string> = {}) {
	return {
		fk: itemId(),
		type: "pickup",
		value: "pending",
		...overrides,
	};
}

function transaction(overrides: Record<string, string> = {}) {
	return {
		fk: itemId(),
		type: "charge",
		status: "succeeded",
		...overrides,
	};
}

const REMOVED_VALUES = [
	"transaction_failed",
	"given_failed",
	"sent_failed",
	"reception_failed",
	"charge_initiated",
	"charge_completed",
	"transfer_initiated",
	"transfer_completed",
];

beforeEach(async () => {
	await drainPurchaseQueues();
	await db.delete(schema.item_status_history);
});

describe.serial("purchase flow", () => {
	describe("validatePurchaseMessage", () => {
		it("rejects removed message values as unknown", async () => {
			for (const value of REMOVED_VALUES) {
				const verdict = await validatePurchaseMessage(
					message({ value }),
				);
				expect(verdict).toEqual({
					ok: false,
					reason: `Unknown message value "${value}"`,
				});
			}
		});

		it("accepts request_failed at any status with no reaction", async () => {
			const fk = itemId();
			await appendStatus(fk, "sold");
			expect(
				await validatePurchaseMessage(
					message({ fk, value: "request_failed" }),
				),
			).toEqual({ ok: true });
			await reactToPurchaseMessage(
				message({ fk, value: "request_failed" }),
			);
			expect(await currentStatus(fk)).toBe("sold");
		});

		it("accepts failed on delivery and shipping at sold", async () => {
			const deliveryItem = itemId();
			const shippingItem = itemId();
			await appendStatus(deliveryItem, "sold");
			await appendStatus(shippingItem, "sold");

			expect(
				await validatePurchaseMessage(
					message({
						fk: deliveryItem,
						type: "delivery",
						value: "failed",
					}),
				),
			).toEqual({ ok: true });
			expect(
				await validatePurchaseMessage(
					message({
						fk: shippingItem,
						type: "shipping",
						value: "failed",
					}),
				),
			).toEqual({ ok: true });
		});

		it("accepts accept at sold without regressing status", async () => {
			const fk = itemId();
			await appendStatus(fk, "sold");
			expect(
				await validatePurchaseMessage(
					message({ fk, type: "delivery", value: "accept" }),
				),
			).toEqual({ ok: true });
		});

		it("accepts transaction_completed and transaction_rejected at sold", async () => {
			const fk = itemId();
			await appendStatus(fk, "sold");
			expect(
				await validatePurchaseMessage(
					message({ fk, value: "transaction_completed" }),
				),
			).toEqual({ ok: true });
			expect(
				await validatePurchaseMessage(
					message({ fk, value: "transaction_rejected" }),
				),
			).toEqual({ ok: true });
		});

		it("rejects pending on sold items", async () => {
			const fk = itemId();
			await appendStatus(fk, "sold");

			const verdict = await validatePurchaseMessage(
				message({ fk, value: "pending" }),
			);

			expect(verdict).toEqual({
				ok: false,
				reason: 'Cannot send "pending" while item status is "sold"',
			});
		});

		it("rejects pending and accept while a flow is pending", async () => {
			const fk = itemId();
			await appendStatus(fk, "pickup_pending");

			expect(
				await validatePurchaseMessage(
					message({ fk, value: "pending" }),
				),
			).toEqual({
				ok: false,
				reason: 'Cannot send "pending" while item status is "pickup_pending"',
			});
			expect(
				await validatePurchaseMessage(message({ fk, value: "accept" })),
			).toEqual({
				ok: false,
				reason: 'Cannot send "accept" while item status is "pickup_pending"',
			});
		});

		it("rejects handshake values outside pickup_pending or sold", async () => {
			expect(
				await validatePurchaseMessage(
					message({ value: "transaction" }),
				),
			).toEqual({
				ok: false,
				reason: 'Cannot send "transaction" while item status is "available"',
			});
		});

		it("rejects fulfillment values outside sold", async () => {
			const fk = itemId();
			await appendStatus(fk, "pickup_pending");

			expect(
				await validatePurchaseMessage(
					message({ fk, type: "delivery", value: "given" }),
				),
			).toEqual({
				ok: false,
				reason: 'Cannot send "given" while item status is "pickup_pending"',
			});
		});

		it("rejects type and value mismatches", async () => {
			const fk = itemId();
			await appendStatus(fk, "sold");

			expect(
				await validatePurchaseMessage(
					message({ fk, type: "shipping", value: "given" }),
				),
			).toEqual({
				ok: false,
				reason: '"given" is only valid on delivery chains',
			});

			expect(
				await validatePurchaseMessage(
					message({ fk, type: "delivery", value: "sent" }),
				),
			).toEqual({
				ok: false,
				reason: '"sent" is only valid on shipping chains',
			});
		});

		it("allows reject and cancel", async () => {
			const fk = itemId();
			await appendStatus(fk, "sold");

			expect(
				await validatePurchaseMessage(message({ fk, value: "reject" })),
			).toEqual({
				ok: true,
			});
			expect(
				await validatePurchaseMessage(message({ fk, value: "cancel" })),
			).toEqual({
				ok: true,
			});
		});
	});

	describe("purchase reactions", () => {
		it("appends type_pending on accept", async () => {
			const payload = message({ type: "delivery", value: "accept" });
			await reactToPurchaseMessage(payload);

			expect(await currentStatus(payload.fk)).toBe("delivery_pending");
		});

		it("does not regress sold when accept arrives after sold", async () => {
			const payload = message({ type: "delivery", value: "accept" });
			await appendStatus(payload.fk, "sold");
			await reactToPurchaseMessage(payload);
			expect(await currentStatus(payload.fk)).toBe("sold");
		});

		it("appends available for negative pickup_pending values", async () => {
			const payload = message({ type: "pickup", value: "accept" });
			await reactToPurchaseMessage(payload);
			expect(await currentStatus(payload.fk)).toBe("pickup_pending");

			await reactToPurchaseMessage({
				...payload,
				value: "transaction_rejected",
			});
			expect(await currentStatus(payload.fk)).toBe("available");
		});

		it("appends available for failed after sold", async () => {
			const payload = message({
				type: "delivery",
				value: "accept",
			});
			await reactToPurchaseMessage(payload);
			await appendStatus(payload.fk, "sold");

			await reactToPurchaseMessage({
				...payload,
				type: "delivery",
				value: "failed",
			});
			expect(await currentStatus(payload.fk)).toBe("available");
		});

		it("does not append for non-trigger values", async () => {
			const pending = message({ value: "pending" });
			await reactToPurchaseMessage(pending);
			await reactToPurchaseMessage(message({ value: "reject" }));
			await reactToPurchaseMessage(
				message({ type: "pickup", value: "transaction" }),
			);

			expect(await currentStatus(pending.fk)).toBe("available");
		});

		it("no-ops when the status already moved", async () => {
			const payload = message({ value: "accept" });
			await appendStatus(payload.fk, "pickup_pending");
			await reactToPurchaseMessage(payload);

			const rows = await db
				.select()
				.from(schema.item_status_history)
				.where(eq(schema.item_status_history.item_id, payload.fk));
			expect(rows).toHaveLength(1);
		});
	});

	describe("transaction reactions", () => {
		it("appends sold on charge succeeded once", async () => {
			const payload = transaction();
			await reactToTransaction(payload);
			expect(await currentStatus(payload.fk)).toBe("sold");

			await reactToTransaction(payload);
			const rows = await db
				.select()
				.from(schema.item_status_history)
				.where(eq(schema.item_status_history.item_id, payload.fk));
			expect(rows).toHaveLength(1);
		});

		it("ignores other transaction type/status combinations", async () => {
			const payload = transaction({ status: "initiated" });
			await reactToTransaction(payload);
			expect(await currentStatus(payload.fk)).toBe("available");
		});
	});
});
