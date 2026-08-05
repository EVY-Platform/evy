import { describe, expect, it } from "bun:test";
import * as schema from "evy-types/db/schema.generated";
import {
	appendTransactionRow,
	findRowsByIntentId,
	hasRow,
} from "../procedures/paymentsShared";
import { handlePaymentWebhook } from "../procedures/paymentWebhook";
import { createSeededIntent, setupPaymentTestDb } from "./wsTestHelpers";

const { testDb, dataDb } = setupPaymentTestDb();

async function createIntentWithInitiatedRow() {
	const { intent, intentId } = await createSeededIntent(testDb, dataDb);
	await appendTransactionRow(dataDb, intent, "charge", "initiated");
	return { intent, intentId };
}

describe("payment_webhook handler", () => {
	it("writes charge succeeded and completed rows for capture events", async () => {
		const { intentId } = await createIntentWithInitiatedRow();

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
		const { intent, intentId } = await createIntentWithInitiatedRow();
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
		const { intentId } = await createIntentWithInitiatedRow();
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
					type: "payment_intent.canceled",
					payment_intent_id: crypto.randomUUID(),
				},
				dataDb,
			),
		).rejects.toThrow("payment intent not found");
	});

	it("rejects out-of-order capture_succeeded without initiated row", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		await expect(
			handlePaymentWebhook(
				{
					type: "payment_intent.capture_succeeded",
					payment_intent_id: intentId,
				},
				dataDb,
			),
		).rejects.toThrow("capture not initiated");
	});

	it("rejects charge.completed without succeeded row", async () => {
		const { intentId } = await createIntentWithInitiatedRow();
		await expect(
			handlePaymentWebhook(
				{ type: "charge.completed", payment_intent_id: intentId },
				dataDb,
			),
		).rejects.toThrow("charge not succeeded");
	});

	it("rejects transfer events without initiated transfer row", async () => {
		const { intentId } = await createIntentWithInitiatedRow();
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

	it("appends charge canceled row for payment_intent.canceled", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);

		await handlePaymentWebhook(
			{ type: "payment_intent.canceled", payment_intent_id: intentId },
			dataDb,
		);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "charge", "canceled")).toBe(true);
	});

	it("is idempotent when canceled row already exists", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		await handlePaymentWebhook(
			{ type: "payment_intent.canceled", payment_intent_id: intentId },
			dataDb,
		);
		const before = await testDb.select().from(schema.transaction);

		const response = await handlePaymentWebhook(
			{ type: "payment_intent.canceled", payment_intent_id: intentId },
			dataDb,
		);

		expect(response).toEqual({ received: true });
		expect(await testDb.select().from(schema.transaction)).toHaveLength(
			before.length,
		);
	});

	it("authors charge_failed on capture_failed", async () => {
		const { intentId } = await createIntentWithInitiatedRow();
		await handlePaymentWebhook(
			{
				type: "payment_intent.capture_failed",
				payment_intent_id: intentId,
			},
			dataDb,
		);
		const messages = await testDb.select().from(schema.message);
		expect(messages.some((row) => row.value === "charge_failed")).toBe(
			true,
		);
	});
});
