import { beforeEach, describe, expect, it } from "bun:test";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import { MOCK_TRANSFER_FAILURE_AMOUNT } from "evy-types/paymentMocks";
import { buildTransactionSignature } from "evy-types/paymentSignature";
import {
	paymentCancel,
	paymentCapture,
	paymentIntent,
	paymentTransfer,
} from "../procedures/payments";
import { findRowsByIntentId, hasRow } from "../procedures/paymentsShared";
import {
	type StripeGateway,
	type StripeIntentParams,
	type StripeTransferParams,
	setStripeGatewayForTests,
} from "../procedures/stripeGateway";
import {
	createCapturedIntent,
	createSeededIntent,
	setupPaymentTestDb,
	validPaymentIntentRequest,
} from "./wsTestHelpers";

const { testDb, dataDb } = setupPaymentTestDb();

const { api, get } = await import("../procedures/rpc");

describe("payment_intent procedure", () => {
	it("creates a charge intent transaction and returns it", async () => {
		const request = validPaymentIntentRequest();
		const created = await paymentIntent(request, dataDb);

		expect(created.id).toBeDefined();
		expect(created.created_at).toBeDefined();
		expect(created.updated_at).toBeDefined();
		expect(created.type).toBe("charge");
		expect(created.status).toBe("intent");
		expect(created.fk).toBe(request.fk);
		expect(created.resource).toBe(request.resource);
		expect(created.amount).toBe(250);
		expect(created.currency).toBe("AUD");
		expect(created.authorization_message_id).toBe(
			request.authorization_message_id,
		);
		expect(created.payment_provider).toBe("stripe");
		expect(created.payment_provider_fee).toBe(0);
		expect(created.service_fee).toBe(0);
		expect(created.signature).toEqual(request.signature);
		expect(created.visibility).toBe("public");
		expect(created.payment_provider_transaction_id).toMatch(/^pi_mock_/);

		const listed = await get(
			{ resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS },
			dataDb,
		);
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({
			id: created.id,
			type: "charge",
			status: "intent",
		});
	});

	it("stores the request signature on the intent row", async () => {
		const request = validPaymentIntentRequest();
		const created = await paymentIntent(request, dataDb);
		expect(created.signature).toEqual(request.signature);
	});

	it("copies the intent signature onto capture and transfer ledger rows", async () => {
		const { intent, intentId } = await createSeededIntent(testDb, dataDb);
		await paymentCapture({ payment_intent_id: intentId }, dataDb);
		await paymentTransfer({ payment_intent_id: intentId }, dataDb);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(rows.length).toBeGreaterThanOrEqual(5);
		for (const row of rows) {
			expect(row.signature).toEqual(intent.signature);
		}
	});

	it("rejects a tampered hash before creating a Stripe intent", async () => {
		const base = validPaymentIntentRequest();
		const request = validPaymentIntentRequest({
			...base,
			signature: { ...base.signature, hash: "0".repeat(64) },
		});
		const fakeGateway = {
			createCalls: 0,
			async createPaymentIntent() {
				fakeGateway.createCalls += 1;
				return { id: `pi_fake_${crypto.randomUUID()}` };
			},
			async capturePaymentIntent() {
				return { ok: true as const };
			},
			async cancelPaymentIntent() {
				return { ok: true as const };
			},
			async createTransfer() {
				return { ok: true as const };
			},
			async getPaymentMethodLast4() {
				return "4242";
			},
		};
		setStripeGatewayForTests(fakeGateway);

		await expect(paymentIntent(request, dataDb)).rejects.toThrow(
			"invalid payment signature: hash mismatch",
		);
		expect(fakeGateway.createCalls).toBe(0);
		const listed = await get(
			{ resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS },
			dataDb,
		);
		expect(listed).toHaveLength(0);
	});

	it("rejects a last-4 mismatch before creating a Stripe intent", async () => {
		const authorization_message_id = crypto.randomUUID();
		const request = validPaymentIntentRequest({
			authorization_message_id,
			signature: buildTransactionSignature({
				amount: 250,
				currency: "AUD",
				authorization_message_id,
				created_at: new Date().toISOString(),
				payment_provider: "stripe",
				payment_method_last_4_characters: "1234",
			}),
		});
		const fakeGateway = {
			createCalls: 0,
			async createPaymentIntent() {
				fakeGateway.createCalls += 1;
				return { id: `pi_fake_${crypto.randomUUID()}` };
			},
			async capturePaymentIntent() {
				return { ok: true as const };
			},
			async cancelPaymentIntent() {
				return { ok: true as const };
			},
			async createTransfer() {
				return { ok: true as const };
			},
			async getPaymentMethodLast4() {
				return "4242";
			},
		};
		setStripeGatewayForTests(fakeGateway);

		await expect(paymentIntent(request, dataDb)).rejects.toThrow(
			"invalid payment signature: payment_method_last_4_characters mismatch",
		);
		expect(fakeGateway.createCalls).toBe(0);
	});

	it("rejects an amount mismatch before creating a Stripe intent", async () => {
		const authorization_message_id = crypto.randomUUID();
		const request = validPaymentIntentRequest({
			amount: 250,
			authorization_message_id,
			signature: buildTransactionSignature({
				amount: 251,
				currency: "AUD",
				authorization_message_id,
				created_at: new Date().toISOString(),
				payment_provider: "stripe",
				payment_method_last_4_characters: "4242",
			}),
		});
		const fakeGateway = {
			createCalls: 0,
			async createPaymentIntent() {
				fakeGateway.createCalls += 1;
				return { id: `pi_fake_${crypto.randomUUID()}` };
			},
			async capturePaymentIntent() {
				return { ok: true as const };
			},
			async cancelPaymentIntent() {
				return { ok: true as const };
			},
			async createTransfer() {
				return { ok: true as const };
			},
			async getPaymentMethodLast4() {
				return "4242";
			},
		};
		setStripeGatewayForTests(fakeGateway);

		await expect(paymentIntent(request, dataDb)).rejects.toThrow(
			"invalid payment signature: amount mismatch",
		);
		expect(fakeGateway.createCalls).toBe(0);
	});
});

describe("payment_capture procedure", () => {
	it("returns initiated row and auto-webhook appends succeeded and completed rows", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		const captured = await paymentCapture(
			{ payment_intent_id: intentId },
			dataDb,
		);

		expect(captured.type).toBe("charge");
		expect(captured.status).toBe("initiated");
		expect(captured.payment_provider_transaction_id).toBe(intentId);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "charge", "initiated")).toBe(true);
		expect(hasRow(rows, "charge", "succeeded")).toBe(true);
		expect(hasRow(rows, "charge", "completed")).toBe(true);
	});

	it("rejects an unknown intent id", async () => {
		await expect(
			paymentCapture({ payment_intent_id: crypto.randomUUID() }, dataDb),
		).rejects.toThrow("payment intent not found");
	});

	it("rejects a second capture of the same intent", async () => {
		const { intentId } = await createCapturedIntent(testDb, dataDb);
		await expect(
			paymentCapture({ payment_intent_id: intentId }, dataDb),
		).rejects.toThrow("payment intent already captured");
	});
});

describe("payment_cancel procedure", () => {
	it("appends charge canceled row and returns it", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		const canceled = await paymentCancel(
			{ payment_intent_id: intentId },
			dataDb,
		);

		expect(canceled.type).toBe("charge");
		expect(canceled.status).toBe("canceled");
		expect(canceled.payment_provider_transaction_id).toBe(intentId);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "charge", "canceled")).toBe(true);
	});

	it("second cancel is idempotent and returns the existing row", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		const first = await paymentCancel(
			{ payment_intent_id: intentId },
			dataDb,
		);
		const second = await paymentCancel(
			{ payment_intent_id: intentId },
			dataDb,
		);

		expect(second.id).toBe(first.id);
		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(
			rows.filter(
				(row) => row.type === "charge" && row.status === "canceled",
			),
		).toHaveLength(1);
	});

	it("rejects cancel after capture initiated", async () => {
		const { intentId } = await createCapturedIntent(testDb, dataDb);
		await expect(
			paymentCancel({ payment_intent_id: intentId }, dataDb),
		).rejects.toThrow("payment intent already captured");
	});

	it("rejects capture after cancel", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		await paymentCancel({ payment_intent_id: intentId }, dataDb);
		await expect(
			paymentCapture({ payment_intent_id: intentId }, dataDb),
		).rejects.toThrow("payment intent canceled");
	});

	it("rejects an unknown intent id", async () => {
		await expect(
			paymentCancel({ payment_intent_id: crypto.randomUUID() }, dataDb),
		).rejects.toThrow("payment intent not found");
	});
});

describe("payment_transfer procedure", () => {
	it("creates transfer initiated/succeeded/completed rows", async () => {
		const { intentId } = await createCapturedIntent(testDb, dataDb);
		const transferred = await paymentTransfer(
			{ payment_intent_id: intentId },
			dataDb,
		);

		expect(transferred.type).toBe("transfer");
		expect(transferred.status).toBe("initiated");

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "transfer", "initiated")).toBe(true);
		expect(hasRow(rows, "transfer", "succeeded")).toBe(true);
		expect(hasRow(rows, "transfer", "completed")).toBe(true);
	});

	it("rejects when charge has not succeeded", async () => {
		const { intentId } = await createSeededIntent(testDb, dataDb);
		await expect(
			paymentTransfer({ payment_intent_id: intentId }, dataDb),
		).rejects.toThrow("payment charge not succeeded");
	});

	it("rejects a duplicate transfer", async () => {
		const { intentId } = await createCapturedIntent(testDb, dataDb);
		await paymentTransfer({ payment_intent_id: intentId }, dataDb);
		await expect(
			paymentTransfer({ payment_intent_id: intentId }, dataDb),
		).rejects.toThrow("payment intent already transferred");
	});

	it("with MOCK_TRANSFER_FAILURE_AMOUNT appends failed row and transfer_failed message", async () => {
		const { intentId } = await createCapturedIntent(testDb, dataDb, {
			amount: MOCK_TRANSFER_FAILURE_AMOUNT,
		});
		await paymentTransfer({ payment_intent_id: intentId }, dataDb);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "transfer", "failed")).toBe(true);
		expect(hasRow(rows, "transfer", "succeeded")).toBe(false);
		expect(hasRow(rows, "transfer", "completed")).toBe(false);

		const failedRow = rows.find(
			(row) => row.type === "transfer" && row.status === "failed",
		);
		expect(failedRow?.error).toBe("mock transfer failure");

		const messages = await testDb.select().from(schema.message);
		expect(messages.some((row) => row.value === "transfer_failed")).toBe(
			true,
		);
	});
});

describe("core api payment dispatch", () => {
	const dispatchCases: Array<{
		method: string;
		setup: () => Promise<{
			data: Record<string, unknown>;
			expected: Record<string, unknown>;
		}>;
		invalidData: Record<string, unknown>;
		expectedError: string;
	}> = [
		{
			method: "payment_intent",
			setup: async () => {
				const request = validPaymentIntentRequest();
				return {
					data: { ...request },
					expected: {
						type: "charge",
						status: "intent",
						fk: request.fk,
						amount: 250,
					},
				};
			},
			invalidData: { ...validPaymentIntentRequest(), amount: 0 },
			expectedError: "PaymentIntentRequest validation failed",
		},
		{
			method: "payment_capture",
			setup: async () => {
				const { intentId } = await createSeededIntent(testDb, dataDb);
				return {
					data: { payment_intent_id: intentId },
					expected: {
						type: "charge",
						status: "initiated",
						payment_provider_transaction_id: intentId,
					},
				};
			},
			invalidData: { payment_intent_id: "" },
			expectedError: "PaymentCaptureRequest validation failed",
		},
		{
			method: "payment_cancel",
			setup: async () => {
				const { intentId } = await createSeededIntent(testDb, dataDb);
				return {
					data: { payment_intent_id: intentId },
					expected: {
						type: "charge",
						status: "canceled",
						payment_provider_transaction_id: intentId,
					},
				};
			},
			invalidData: { payment_intent_id: "" },
			expectedError: "PaymentCancelRequest validation failed",
		},
		{
			method: "payment_transfer",
			setup: async () => {
				const { intentId } = await createCapturedIntent(testDb, dataDb);
				return {
					data: { payment_intent_id: intentId },
					expected: {
						type: "transfer",
						status: "initiated",
						payment_provider_transaction_id: intentId,
					},
				};
			},
			invalidData: { payment_intent_id: "" },
			expectedError: "PaymentTransferRequest validation failed",
		},
		{
			method: "payment_webhook",
			setup: async () => {
				const { intentId } = await createSeededIntent(testDb, dataDb);
				return {
					data: {
						type: "payment_intent.canceled",
						payment_intent_id: intentId,
					},
					expected: { received: true },
				};
			},
			invalidData: {
				type: "unknown.event",
				payment_intent_id: crypto.randomUUID(),
			},
			expectedError: "PaymentWebhookRequest validation failed",
		},
	];

	it.each(dispatchCases)("$method is reachable via api{service:evy}", async ({
		method,
		setup,
	}) => {
		const { data, expected } = await setup();
		const response = await api(
			{ service: EVY_CORE_SERVICE, method, data },
			dataDb,
		);
		expect(response).toMatchObject(expected);
	});

	it.each(
		dispatchCases,
	)("$method rejects an invalid request with validation failed", async ({
		method,
		invalidData,
		expectedError,
	}) => {
		await expect(
			api(
				{ service: EVY_CORE_SERVICE, method, data: invalidData },
				dataDb,
			),
		).rejects.toThrow(expectedError);
	});
});

describe("payments with real-mode gateway", () => {
	let fakeGateway: StripeGateway & {
		createCalls: StripeIntentParams[];
		captureCalls: Array<{ id: string; amount: number }>;
		transferCalls: StripeTransferParams[];
	};

	beforeEach(() => {
		fakeGateway = {
			createCalls: [],
			captureCalls: [],
			transferCalls: [],
			async createPaymentIntent(params) {
				fakeGateway.createCalls.push(params);
				return { id: `pi_fake_${crypto.randomUUID()}` };
			},
			async capturePaymentIntent(id, amount) {
				fakeGateway.captureCalls.push({ id, amount });
				return { ok: true };
			},
			async cancelPaymentIntent() {
				return { ok: true };
			},
			async createTransfer(params) {
				fakeGateway.transferCalls.push(params);
				return { ok: true };
			},
			async getPaymentMethodLast4() {
				return "4242";
			},
		};
		setStripeGatewayForTests(fakeGateway);
	});

	it("passes metadata to the gateway and stores the returned intent id", async () => {
		const request = validPaymentIntentRequest();
		const created = await paymentIntent(request, dataDb);

		expect(fakeGateway.createCalls).toHaveLength(1);
		expect(fakeGateway.createCalls[0]).toEqual({
			amount: request.amount,
			currency: request.currency,
			metadata: {
				fk: request.fk,
				resource: request.resource,
				authorization_message_id: request.authorization_message_id,
			},
		});
		expect(created.payment_provider_transaction_id).toMatch(/^pi_fake_/);
	});

	it("passes intent fields and metadata to createTransfer", async () => {
		const { intent, intentId } = await createCapturedIntent(testDb, dataDb);
		await paymentTransfer({ payment_intent_id: intentId }, dataDb);

		expect(fakeGateway.transferCalls).toHaveLength(1);
		expect(fakeGateway.transferCalls[0]).toEqual({
			paymentIntentId: intentId,
			amount: intent.amount,
			currency: intent.currency,
			metadata: {
				fk: intent.fk,
				resource: intent.resource,
				authorization_message_id: intent.authorization_message_id,
			},
		});
	});

	it("calls capture on the gateway and appends failure rows on capture error", async () => {
		fakeGateway.capturePaymentIntent = async (id, amount) => {
			fakeGateway.captureCalls.push({ id, amount });
			return { ok: false, reason: "card declined" };
		};

		const { request, intentId } = await createSeededIntent(testDb, dataDb);
		await paymentCapture({ payment_intent_id: intentId }, dataDb);

		expect(fakeGateway.captureCalls).toEqual([
			{ id: intentId, amount: request.amount },
		]);

		const rows = await findRowsByIntentId(dataDb, intentId);
		expect(hasRow(rows, "charge", "failed")).toBe(true);
		expect(hasRow(rows, "charge", "succeeded")).toBe(false);

		const failedRow = rows.find(
			(row) => row.type === "charge" && row.status === "failed",
		);
		expect(failedRow?.error).toBe("card declined");

		const messages = await testDb.select().from(schema.message);
		const chargeFailed = messages.find(
			(row) => row.value === "charge_failed",
		);
		expect(chargeFailed).toBeDefined();
		expect(chargeFailed?.fk).toBe(request.fk);
		expect(chargeFailed?.resource).toBe(request.resource);
		expect(chargeFailed?.type).toBe("pickup");
	});
});
