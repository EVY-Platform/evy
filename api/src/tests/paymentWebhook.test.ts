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
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import { paymentIntent } from "../procedures/payments";
import {
	appendTransactionRow,
	findRowsByIntentId,
	hasRow,
} from "../procedures/paymentsShared";
import { handlePaymentWebhook } from "../procedures/paymentWebhook";
import { setStripeGatewayForTests } from "../procedures/stripeGateway";
import { createMockStripeGateway } from "../procedures/stripeGatewayMock";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
	seedAuthorizationMessage,
	validPaymentIntentRequest,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const { api } = await import("../procedures/rpc");

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	setStripeGatewayForTests(createMockStripeGateway());
	await clearAllTestTables(testDb);
});

afterEach(() => {
	setStripeGatewayForTests(undefined);
});

async function createIntentWithInitiatedRow() {
	const request = validPaymentIntentRequest();
	await seedAuthorizationMessage(testDb, request);
	const intent = await paymentIntent(request, dataDb);
	await appendTransactionRow(dataDb, intent, "charge", "initiated");
	return { request, intent };
}

describe("payment_webhook handler", () => {
	it("acks payment_intent.succeeded without writing a row", async () => {
		const request = validPaymentIntentRequest();
		const intent = await paymentIntent(request, dataDb);
		const before = await testDb.select().from(schema.transaction);

		const response = await handlePaymentWebhook(
			{
				type: "payment_intent.succeeded",
				payment_intent_id: intent.payment_provider_transaction_id,
			},
			dataDb,
		);

		expect(response).toEqual({ received: true });
		expect(await testDb.select().from(schema.transaction)).toHaveLength(
			before.length,
		);
	});

	it("writes charge succeeded and completed rows for capture events", async () => {
		const { intent } = await createIntentWithInitiatedRow();
		const intentId = intent.payment_provider_transaction_id;

		await handlePaymentWebhook(
			{
				type: "payment_intent.capture_succeeded",
				payment_intent_id: intentId,
			},
			dataDb,
		);
		await handlePaymentWebhook(
			{ type: "charge.completed", payment_intent_id: intentId },
			dataDb,
		);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "charge", "succeeded")).toBe(true);
		expect(hasRow(rows, "charge", "completed")).toBe(true);
	});

	it("writes transfer succeeded and completed rows", async () => {
		const { intent } = await createIntentWithInitiatedRow();
		const intentId = intent.payment_provider_transaction_id;
		await handlePaymentWebhook(
			{
				type: "payment_intent.capture_succeeded",
				payment_intent_id: intentId,
			},
			dataDb,
		);
		await appendTransactionRow(dataDb, intent, "transfer", "initiated");
		await handlePaymentWebhook(
			{ type: "transfer.succeeded", payment_intent_id: intentId },
			dataDb,
		);
		await handlePaymentWebhook(
			{ type: "transfer.completed", payment_intent_id: intentId },
			dataDb,
		);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "transfer", "succeeded")).toBe(true);
		expect(hasRow(rows, "transfer", "completed")).toBe(true);
	});

	it("is idempotent when the target row already exists", async () => {
		const { intent } = await createIntentWithInitiatedRow();
		const intentId = intent.payment_provider_transaction_id;
		await handlePaymentWebhook(
			{
				type: "payment_intent.capture_succeeded",
				payment_intent_id: intentId,
			},
			dataDb,
		);
		const before = await testDb.select().from(schema.transaction);

		const response = await handlePaymentWebhook(
			{
				type: "payment_intent.capture_succeeded",
				payment_intent_id: intentId,
			},
			dataDb,
		);

		expect(response).toEqual({ received: true });
		expect(await testDb.select().from(schema.transaction)).toHaveLength(
			before.length,
		);
	});

	it("rejects unknown payment_intent_id", async () => {
		await expect(
			handlePaymentWebhook(
				{
					type: "payment_intent.succeeded",
					payment_intent_id: crypto.randomUUID(),
				},
				dataDb,
			),
		).rejects.toThrow("payment intent not found");
	});

	it("rejects out-of-order capture_succeeded without initiated row", async () => {
		const request = validPaymentIntentRequest();
		const intent = await paymentIntent(request, dataDb);
		await expect(
			handlePaymentWebhook(
				{
					type: "payment_intent.capture_succeeded",
					payment_intent_id: intent.payment_provider_transaction_id,
				},
				dataDb,
			),
		).rejects.toThrow("capture not initiated");
	});

	it("rejects charge.completed without succeeded row", async () => {
		const { intent } = await createIntentWithInitiatedRow();
		await expect(
			handlePaymentWebhook(
				{
					type: "charge.completed",
					payment_intent_id: intent.payment_provider_transaction_id,
				},
				dataDb,
			),
		).rejects.toThrow("charge not succeeded");
	});

	it("rejects transfer events without initiated transfer row", async () => {
		const { intent } = await createIntentWithInitiatedRow();
		const intentId = intent.payment_provider_transaction_id;
		await handlePaymentWebhook(
			{
				type: "payment_intent.capture_succeeded",
				payment_intent_id: intentId,
			},
			dataDb,
		);
		await expect(
			handlePaymentWebhook(
				{ type: "transfer.succeeded", payment_intent_id: intentId },
				dataDb,
			),
		).rejects.toThrow("transfer not initiated");
	});

	it("authors charge_failed on capture_failed", async () => {
		const { intent } = await createIntentWithInitiatedRow();
		await handlePaymentWebhook(
			{
				type: "payment_intent.capture_failed",
				payment_intent_id: intent.payment_provider_transaction_id,
			},
			dataDb,
		);
		const messages = await testDb.select().from(schema.message);
		expect(messages.some((row) => row.value === "charge_failed")).toBe(
			true,
		);
	});

	it("is reachable via api{service:evy, method:payment_webhook}", async () => {
		const request = validPaymentIntentRequest();
		const intent = await paymentIntent(request, dataDb);
		const response = await api(
			{
				service: EVY_CORE_SERVICE,
				method: "payment_webhook",
				data: {
					type: "payment_intent.succeeded",
					payment_intent_id: intent.payment_provider_transaction_id,
				},
			},
			dataDb,
		);
		expect(response).toEqual({ received: true });
	});

	it("rejects unknown event type via request validation", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "payment_webhook",
					data: {
						type: "unknown.event",
						payment_intent_id: crypto.randomUUID(),
					},
				},
				dataDb,
			),
		).rejects.toThrow("PaymentWebhookRequest validation failed");
	});
});
