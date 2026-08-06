import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import type { DATA_EVY_Transaction } from "evy-types";
import { nowIso as clockNowIso } from "evy-types/clock";

import { db, schema } from "../db";
import {
	extendIntentToMessage,
	findIntentByAuthorizationMessageId,
	recordPaymentIntent,
} from "../paymentIntents";
import {
	paymentActionForMessage,
	runPaymentReaction,
	validatePaymentPreconditions,
} from "../payments";
import { MARKETPLACE_RESOURCE } from "../resources";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

const coreApiCalls: Array<{ method: string; data: unknown }> = [];
let captureShouldFail = false;

mock.module("../coreClient", () => ({
	callCoreApi: async (method: string, data: unknown) => {
		coreApiCalls.push({ method, data });
		if (method === "payment_capture" && captureShouldFail) {
			throw new Error("capture failed");
		}
		if (method === "payment_intent") {
			return {
				payment_provider_transaction_id: `pi_test_${crypto.randomUUID()}`,
			} satisfies Pick<
				DATA_EVY_Transaction,
				"payment_provider_transaction_id"
			>;
		}
		return {};
	},
}));

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
});

beforeEach(async () => {
	coreApiCalls.length = 0;
	captureShouldFail = false;
	await db.delete(schema.item_payment_intents);
	await db.delete(schema.data);
});

afterAll(() => {
	mock.restore();
});

const itemId = "00000000-0000-4000-8000-000000000010";
const authMessageId = "00000000-0000-4000-8000-000000000020";
const parentMessageId = "00000000-0000-4000-8000-000000000030";

async function seedItem(price?: {
	currency?: string;
	value?: number | string;
}) {
	const now = clockNowIso();
	await db.insert(schema.data).values({
		id: itemId,
		resource: MARKETPLACE_RESOURCE.ITEMS,
		data: {
			id: itemId,
			title: "test item",
			...(price ? { price } : {}),
		},
		created_at: now,
		updated_at: now,
	});
}

describe("paymentActionForMessage", () => {
	it.each([
		["pickup", "pending", "none"],
		["pickup", "accept", "none"],
		["pickup", "reject", "none"],
		["pickup", "cancel", "payment_cancel"],
		["pickup", "transaction", "payment_intent"],
		["pickup", "transaction_completed", "payment_capture_then_transfer"],
		["pickup", "transaction_rejected", "payment_cancel"],
		["delivery", "pending", "payment_intent"],
		["delivery", "accept", "payment_capture"],
		["delivery", "reject", "payment_cancel"],
		["delivery", "cancel", "payment_cancel"],
		["delivery", "given", "none"],
		["delivery", "failed", "none"],
		["delivery", "received", "payment_transfer"],
		["shipping", "pending", "payment_intent"],
		["shipping", "accept", "payment_capture"],
		["shipping", "reject", "payment_cancel"],
		["shipping", "cancel", "payment_cancel"],
		["shipping", "sent", "none"],
		["shipping", "failed", "none"],
		["shipping", "received", "payment_transfer"],
		["pickup", "charge_failed", "none"],
		["delivery", "unknown_value", "none"],
	] as const)("maps %s/%s to %s", (type, value, expected) => {
		expect(paymentActionForMessage(type, value)).toBe(expected);
	});
});

describe("item payment intent storage", () => {
	it("records and finds intents by authorization message id", async () => {
		const recorded = await recordPaymentIntent({
			itemId,
			authorizationMessageId: authMessageId,
			paymentIntentId: "pi_123",
		});

		expect(recorded.item_id).toBe(itemId);
		expect(
			await findIntentByAuthorizationMessageId(authMessageId),
		).toMatchObject({
			payment_intent_id: "pi_123",
		});
	});
});

describe("validatePaymentPreconditions", () => {
	it("vetoes intent triggers when the item has no valid price", async () => {
		await seedItem();
		const verdict = await validatePaymentPreconditions({
			fk: itemId,
			type: "delivery",
			value: "pending",
		});
		expect(verdict).toEqual({
			ok: false,
			reason: "Item has no valid price for payment",
		});
	});

	it.each([
		["0"],
		[""],
		["not-a-number"],
	] as const)("vetoes non-positive price value %s", async (value) => {
		await seedItem({ currency: "AUD", value });
		const verdict = await validatePaymentPreconditions({
			fk: itemId,
			type: "delivery",
			value: "pending",
		});
		expect(verdict.ok).toBe(false);
	});

	it("accepts numeric and numeric-string prices", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		expect(
			await validatePaymentPreconditions({
				fk: itemId,
				type: "delivery",
				value: "pending",
			}),
		).toEqual({ ok: true });

		await db.delete(schema.data);
		await seedItem({ currency: "AUD", value: "250" });
		expect(
			await validatePaymentPreconditions({
				fk: itemId,
				type: "delivery",
				value: "pending",
			}),
		).toEqual({ ok: true });
	});

	it("vetoes capture when no stored intent exists", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		const verdict = await validatePaymentPreconditions({
			fk: itemId,
			type: "delivery",
			value: "accept",
			parent_message_id: parentMessageId,
		});
		expect(verdict).toEqual({
			ok: false,
			reason: "No payment intent found for this purchase",
		});
	});

	it("accepts capture when a stored intent resolves by parent id", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_parent",
		});
		expect(
			await validatePaymentPreconditions({
				fk: itemId,
				type: "delivery",
				value: "accept",
				parent_message_id: parentMessageId,
			}),
		).toEqual({ ok: true });
	});

	it("skips validation for cancel and non-payment values", async () => {
		expect(
			await validatePaymentPreconditions({
				fk: itemId,
				type: "delivery",
				value: "reject",
			}),
		).toEqual({ ok: true });
		expect(
			await validatePaymentPreconditions({
				fk: itemId,
				type: "pickup",
				value: "pending",
			}),
		).toEqual({ ok: true });
	});
});

describe("runPaymentReaction", () => {
	it("creates a payment intent and persists the provider id", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		await runPaymentReaction({
			id: authMessageId,
			fk: itemId,
			resource: MARKETPLACE_RESOURCE.ITEMS,
			type: "delivery",
			value: "pending",
		});

		expect(coreApiCalls).toEqual([
			{
				method: "payment_intent",
				data: {
					fk: itemId,
					resource: MARKETPLACE_RESOURCE.ITEMS,
					amount: 250,
					currency: "AUD",
					authorization_message_id: authMessageId,
				},
			},
		]);
		const stored = await findIntentByAuthorizationMessageId(authMessageId);
		expect(stored?.payment_intent_id).toMatch(/^pi_test_/);
	});

	it("captures on delivery accept using the parent authorization message", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_capture",
		});
		await runPaymentReaction({
			fk: itemId,
			type: "delivery",
			value: "accept",
			parent_message_id: parentMessageId,
		});

		expect(coreApiCalls).toEqual([
			{
				method: "payment_capture",
				data: { payment_intent_id: "pi_capture" },
			},
		]);
	});

	it("runs capture then transfer for pickup transaction_completed", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_pickup",
		});
		await runPaymentReaction({
			fk: itemId,
			type: "pickup",
			value: "transaction_completed",
			parent_message_id: parentMessageId,
		});

		expect(coreApiCalls.map((call) => call.method)).toEqual([
			"payment_capture",
			"payment_transfer",
		]);
	});

	it("does not transfer when capture fails", async () => {
		captureShouldFail = true;

		await seedItem({ currency: "AUD", value: 250 });
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_fail",
		});
		await runPaymentReaction({
			fk: itemId,
			type: "pickup",
			value: "transaction_completed",
			parent_message_id: parentMessageId,
		});

		expect(coreApiCalls.map((call) => call.method)).toEqual([
			"payment_capture",
		]);
	});

	it("transfers on received answering a mid-thread message via the alias", async () => {
		const givenId = "00000000-0000-4000-8000-000000000050";
		await seedItem({ currency: "AUD", value: 250 });
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_chain",
		});
		// The given message answers the pending; received answers the given.
		await extendIntentToMessage({
			id: givenId,
			fk: itemId,
			parent_message_id: parentMessageId,
		});

		expect(
			await validatePaymentPreconditions({
				fk: itemId,
				type: "delivery",
				value: "received",
				parent_message_id: givenId,
			}),
		).toEqual({ ok: true });

		await runPaymentReaction({
			fk: itemId,
			type: "delivery",
			value: "received",
			parent_message_id: givenId,
		});
		expect(coreApiCalls).toEqual([
			{
				method: "payment_transfer",
				data: { payment_intent_id: "pi_chain" },
			},
		]);
	});

	it("transfers on received only", async () => {
		await seedItem({ currency: "AUD", value: 250 });
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_transfer",
		});
		await runPaymentReaction({
			fk: itemId,
			type: "delivery",
			value: "received",
			parent_message_id: parentMessageId,
		});

		expect(coreApiCalls).toEqual([
			{
				method: "payment_transfer",
				data: { payment_intent_id: "pi_transfer" },
			},
		]);
	});

	it("cancels when a stored intent exists and no-ops otherwise", async () => {
		await recordPaymentIntent({
			itemId,
			authorizationMessageId: parentMessageId,
			paymentIntentId: "pi_cancel",
		});
		await runPaymentReaction({
			fk: itemId,
			type: "delivery",
			value: "reject",
			parent_message_id: parentMessageId,
		});
		expect(coreApiCalls).toEqual([
			{
				method: "payment_cancel",
				data: { payment_intent_id: "pi_cancel" },
			},
		]);

		coreApiCalls.length = 0;
		await runPaymentReaction({
			fk: itemId,
			type: "delivery",
			value: "reject",
			parent_message_id: "00000000-0000-4000-8000-000000000099",
		});
		expect(coreApiCalls).toEqual([]);
	});

	it("does nothing for non-payment values", async () => {
		await runPaymentReaction({
			fk: itemId,
			type: "pickup",
			value: "accept",
		});
		expect(coreApiCalls).toEqual([]);
	});
});
