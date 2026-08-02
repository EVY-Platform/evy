import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

import { db, schema } from "../db";
import {
	awaitPurchaseReaction,
	drainPurchaseQueues,
	validatePurchaseMessage,
} from "../purchase";
import { appendStatus, currentStatus } from "../status";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
});

const itemId = () => crypto.randomUUID();

function message(
	overrides: Partial<{
		fk: string;
		type: string;
		value: string;
	}> = {},
) {
	return {
		fk: overrides.fk ?? itemId(),
		type: overrides.type ?? "pickup",
		value: overrides.value ?? "pending",
		parent_message_id: undefined,
	};
}

beforeEach(async () => {
	await drainPurchaseQueues();
	await db.delete(schema.item_status_history);
});

describe.serial("purchase flow", () => {
	describe("validatePurchaseMessage", () => {
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

		it("rejects handshake values outside pickup_pending", async () => {
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

			expect(
				await validatePurchaseMessage(
					message({ fk, type: "pickup", value: "unknown_value" }),
				),
			).toEqual({
				ok: false,
				reason: 'Unknown message value "unknown_value"',
			});
		});

		it("allows reject, cancel, and payment values", async () => {
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
			expect(
				await validatePurchaseMessage(
					message({ fk, value: "charge_initiated" }),
				),
			).toEqual({ ok: true });
		});
	});

	describe("purchase reactions", () => {
		it("appends type_pending on accept", async () => {
			const payload = message({ type: "delivery", value: "accept" });
			await awaitPurchaseReaction(payload);

			expect(await currentStatus(payload.fk)).toBe("delivery_pending");
		});

		it("appends sold on charge_initiated", async () => {
			const payload = message({ value: "charge_initiated" });
			await appendStatus(payload.fk, "delivery_pending");
			await awaitPurchaseReaction(payload);

			expect(await currentStatus(payload.fk)).toBe("sold");
		});

		it("appends available for negative pickup_pending values", async () => {
			const payload = message({ value: "transaction_rejected" });
			await appendStatus(payload.fk, "pickup_pending");
			await awaitPurchaseReaction(payload);
			expect(await currentStatus(payload.fk)).toBe("available");
		});

		it("appends available for negative sold values", async () => {
			const payload = message({
				type: "delivery",
				value: "given_failed",
			});
			await appendStatus(payload.fk, "sold");
			await awaitPurchaseReaction(payload);
			expect(await currentStatus(payload.fk)).toBe("available");
		});

		it("does not append for non-trigger values", async () => {
			const pending = message({ value: "pending" });
			await awaitPurchaseReaction(pending);
			await awaitPurchaseReaction(message({ value: "reject" }));
			await awaitPurchaseReaction(
				message({ type: "pickup", value: "transaction" }),
			);

			expect(await currentStatus(pending.fk)).toBe("available");
		});

		it("no-ops when the status already moved", async () => {
			const payload = message({ value: "accept" });
			await appendStatus(payload.fk, "pickup_pending");
			await awaitPurchaseReaction(payload);

			const rows = await db
				.select()
				.from(schema.item_status_history)
				.where(eq(schema.item_status_history.item_id, payload.fk));
			expect(rows).toHaveLength(1);
		});
	});
});
