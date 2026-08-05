import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { DATA_EVY_Transaction } from "evy-types";
import Stripe from "stripe";
import {
	appendTransactionRow,
	findRowsByIntentId,
	hasRow,
} from "../procedures/paymentsShared";
import { handleStripeWebhookRequest } from "../shared/stripeWebhookHttp";
import {
	createSeededIntent,
	setupPaymentTestDb,
	stashEnv,
} from "./wsTestHelpers";

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";
const { testDb, dataDb } = setupPaymentTestDb();

let restoreEnv: (() => void) | undefined;

async function signPayload(payload: string): Promise<string> {
	return Stripe.webhooks.generateTestHeaderStringAsync({
		payload,
		secret: WEBHOOK_SECRET,
	});
}

function webhookRequest(body: string, signature?: string): Request {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (signature !== undefined) {
		headers["stripe-signature"] = signature;
	}
	return new Request("http://localhost/webhooks/stripe", {
		method: "POST",
		headers,
		body,
	});
}

beforeEach(() => {
	restoreEnv = stashEnv({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
});

afterEach(() => {
	restoreEnv?.();
});

describe("handleStripeWebhookRequest", () => {
	const successEventCases: Array<
		[
			string,
			DATA_EVY_Transaction["status"],
			DATA_EVY_Transaction["status"][],
			(paymentIntentId: string) => Record<string, unknown>,
		]
	> = [
		[
			"payment_intent.succeeded",
			"succeeded",
			["initiated"],
			(paymentIntentId) => ({
				id: "evt_test",
				object: "event",
				type: "payment_intent.succeeded",
				data: {
					object: {
						id: paymentIntentId,
						object: "payment_intent",
					},
				},
			}),
		],
		[
			"charge.captured",
			"completed",
			["initiated", "succeeded"],
			(paymentIntentId) => ({
				id: "evt_test_charge",
				object: "event",
				type: "charge.captured",
				data: {
					object: {
						id: "ch_test",
						object: "charge",
						payment_intent: paymentIntentId,
					},
				},
			}),
		],
	];

	it.each(
		successEventCases,
	)("maps %s to an internal charge %s row", async (_eventType, expectedStatus, priorStatuses, buildEvent) => {
		const { intent, intentId } = await createSeededIntent(testDb, dataDb);
		for (const status of priorStatuses) {
			await appendTransactionRow(dataDb, intent, "charge", status);
		}

		const payload = JSON.stringify(buildEvent(intentId));
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, await signPayload(payload)),
			dataDb,
		);

		expect(response.status).toBe(200);
		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "charge", expectedStatus)).toBe(true);
	});

	it("returns 400 for missing signature", async () => {
		const payload = JSON.stringify({ type: "payment_intent.succeeded" });
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload),
			dataDb,
		);
		expect(response.status).toBe(400);
	});

	it("returns 400 for invalid signature", async () => {
		const payload = JSON.stringify({ type: "payment_intent.succeeded" });
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, "invalid"),
			dataDb,
		);
		expect(response.status).toBe(400);
	});

	it("acknowledges unhandled event types without writing rows", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);

		const payload = JSON.stringify({
			id: "evt_unhandled",
			object: "event",
			type: "charge.succeeded",
			data: {
				object: {
					id: "ch_test",
					object: "charge",
					payment_intent: intentId,
				},
			},
		});
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, await signPayload(payload)),
			dataDb,
		);

		expect(response.status).toBe(200);
		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(rows).toHaveLength(1);
	});

	it("returns 500 when handler fails for unknown intent", async () => {
		const payload = JSON.stringify({
			id: "evt_unknown",
			object: "event",
			type: "payment_intent.succeeded",
			data: {
				object: {
					id: "pi_unknown",
					object: "payment_intent",
				},
			},
		});
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, await signPayload(payload)),
			dataDb,
		);
		expect(response.status).toBe(500);
	});
});
