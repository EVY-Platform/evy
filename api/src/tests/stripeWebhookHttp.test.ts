import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DATA_EVY_Transaction } from "evy-types";
import { transaction } from "evy-types/db/schema.generated";
import Stripe from "stripe";
import { paymentIntent } from "../procedures/payments";
import { findRowsByIntentId, hasRow } from "../procedures/paymentsShared";
import { setStripeGatewayForTests } from "../procedures/stripeGateway";
import { createMockStripeGateway } from "../procedures/stripeGatewayMock";
import { handleStripeWebhookRequest } from "../shared/stripeWebhookHttp";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
	stashEnv,
	validPaymentIntentRequest,
} from "./wsTestHelpers";

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";
const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

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

async function insertLedgerRow(
	intent: DATA_EVY_Transaction,
	status: DATA_EVY_Transaction["status"],
): Promise<void> {
	const now = new Date().toISOString();
	await testDb.insert(transaction).values({
		...intent,
		id: crypto.randomUUID(),
		status,
		created_at: now,
		updated_at: now,
	});
}

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	restoreEnv = stashEnv({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
	setStripeGatewayForTests(createMockStripeGateway());
	await clearAllTestTables(testDb);
});

afterEach(() => {
	setStripeGatewayForTests(undefined);
	restoreEnv?.();
});

describe("handleStripeWebhookRequest", () => {
	it("processes payment_intent.succeeded into charge succeeded row", async () => {
		const request = validPaymentIntentRequest();
		const intent = await paymentIntent(request, dataDb);
		const paymentIntentId = intent.payment_provider_transaction_id;

		// initiated row required by capture_succeeded handler
		await insertLedgerRow(intent, "initiated");

		const payload = JSON.stringify({
			id: "evt_test",
			object: "event",
			type: "payment_intent.succeeded",
			data: {
				object: {
					id: paymentIntentId,
					object: "payment_intent",
				},
			},
		});
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, await signPayload(payload)),
			dataDb,
		);

		expect(response.status).toBe(200);
		const rows = await findRowsByIntentId(dataDb, paymentIntentId);
		expect(hasRow(rows, "charge", "succeeded")).toBe(true);
	});

	it("maps charge.captured to charge.completed via payment_intent", async () => {
		const request = validPaymentIntentRequest();
		const intent = await paymentIntent(request, dataDb);
		const paymentIntentId = intent.payment_provider_transaction_id;

		await insertLedgerRow(intent, "initiated");
		await insertLedgerRow(intent, "succeeded");

		const payload = JSON.stringify({
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
		});
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, await signPayload(payload)),
			dataDb,
		);

		expect(response.status).toBe(200);
		const rows = await findRowsByIntentId(dataDb, paymentIntentId);
		expect(hasRow(rows, "charge", "completed")).toBe(true);
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
		const request = validPaymentIntentRequest();
		const intent = await paymentIntent(request, dataDb);
		const paymentIntentId = intent.payment_provider_transaction_id;

		const payload = JSON.stringify({
			id: "evt_unhandled",
			object: "event",
			type: "charge.succeeded",
			data: {
				object: {
					id: "ch_test",
					object: "charge",
					payment_intent: paymentIntentId,
				},
			},
		});
		const response = await handleStripeWebhookRequest(
			webhookRequest(payload, await signPayload(payload)),
			dataDb,
		);

		expect(response.status).toBe(200);
		const rows = await findRowsByIntentId(dataDb, paymentIntentId);
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
