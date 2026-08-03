import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import {
	paymentCapture,
	paymentIntent,
	paymentTransfer,
} from "../procedures/payments";
import {
	findRowsByIntentId,
	hasRow,
	MOCK_CAPTURE_FAILURE_AMOUNT,
	MOCK_TRANSFER_FAILURE_AMOUNT,
} from "../procedures/paymentsShared";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
	seedAuthorizationMessage,
	validPaymentIntentRequest,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const { api, get } = await import("../procedures/rpc");

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
});

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
		expect(created.signature).toBe("signed");
		expect(created.visibility).toBe("public");
		expect(created.payment_provider_transaction_id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);

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

	it("accepts a zero amount", async () => {
		const created = await paymentIntent(
			{ ...validPaymentIntentRequest(), amount: 0 },
			dataDb,
		);
		expect(created.amount).toBe(0);
	});

	it("is reachable via api{service:evy, method:payment_intent}", async () => {
		const request = validPaymentIntentRequest();
		const created = await api(
			{
				service: EVY_CORE_SERVICE,
				method: "payment_intent",
				data: request,
			},
			dataDb,
		);

		expect(created).toMatchObject({
			type: "charge",
			status: "intent",
			fk: request.fk,
			amount: 250,
		});
	});

	it("rejects an invalid payment intent request", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "payment_intent",
					data: { ...validPaymentIntentRequest(), amount: -1 },
				},
				dataDb,
			),
		).rejects.toThrow("PaymentIntentRequest validation failed");
	});
});

describe("payment_capture procedure", () => {
	it("returns initiated row and auto-webhook appends succeeded and completed rows", async () => {
		const request = validPaymentIntentRequest();
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		const captured = await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);

		expect(captured.type).toBe("charge");
		expect(captured.status).toBe("initiated");
		expect(captured.payment_provider_transaction_id).toBe(
			intent.payment_provider_transaction_id,
		);

		const rows = await findRowsByIntentId(
			dataDb,
			intent.payment_provider_transaction_id,
		);
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
		const request = validPaymentIntentRequest();
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);
		await expect(
			paymentCapture(
				{ payment_intent_id: intent.payment_provider_transaction_id },
				dataDb,
			),
		).rejects.toThrow("payment intent already captured");
	});

	it("with MOCK_CAPTURE_FAILURE_AMOUNT appends failed row and charge_failed message", async () => {
		const request = validPaymentIntentRequest({
			amount: MOCK_CAPTURE_FAILURE_AMOUNT,
		});
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);

		const rows = await findRowsByIntentId(
			dataDb,
			intent.payment_provider_transaction_id,
		);
		expect(hasRow(rows, "charge", "initiated")).toBe(true);
		expect(hasRow(rows, "charge", "failed")).toBe(true);
		expect(hasRow(rows, "charge", "succeeded")).toBe(false);
		expect(hasRow(rows, "charge", "completed")).toBe(false);

		const messages = await testDb.select().from(schema.message);
		const chargeFailed = messages.find(
			(row) => row.value === "charge_failed",
		);
		expect(chargeFailed).toBeDefined();
		expect(chargeFailed?.fk).toBe(request.fk);
		expect(chargeFailed?.resource).toBe(request.resource);
		expect(chargeFailed?.type).toBe("pickup");
	});

	it("is reachable via api{service:evy, method:payment_capture}", async () => {
		const request = validPaymentIntentRequest();
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		const captured = await api(
			{
				service: EVY_CORE_SERVICE,
				method: "payment_capture",
				data: {
					payment_intent_id: intent.payment_provider_transaction_id,
				},
			},
			dataDb,
		);

		expect(captured).toMatchObject({
			type: "charge",
			status: "initiated",
			payment_provider_transaction_id:
				intent.payment_provider_transaction_id,
		});
	});

	it("rejects an invalid payment capture request", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "payment_capture",
					data: { payment_intent_id: "" },
				},
				dataDb,
			),
		).rejects.toThrow("PaymentCaptureRequest validation failed");
	});
});

describe("payment_transfer procedure", () => {
	async function intentAndCapture() {
		const request = validPaymentIntentRequest();
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		const captured = await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);
		return { intent, captured };
	}

	it("creates transfer initiated/succeeded/completed rows", async () => {
		const { intent } = await intentAndCapture();
		const transferred = await paymentTransfer(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);

		expect(transferred.type).toBe("transfer");
		expect(transferred.status).toBe("initiated");

		const rows = await findRowsByIntentId(
			dataDb,
			intent.payment_provider_transaction_id,
		);
		expect(hasRow(rows, "transfer", "initiated")).toBe(true);
		expect(hasRow(rows, "transfer", "succeeded")).toBe(true);
		expect(hasRow(rows, "transfer", "completed")).toBe(true);
	});

	it("rejects when charge has not succeeded", async () => {
		const request = validPaymentIntentRequest();
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		await expect(
			paymentTransfer(
				{ payment_intent_id: intent.payment_provider_transaction_id },
				dataDb,
			),
		).rejects.toThrow("payment charge not succeeded");
	});

	it("rejects a duplicate transfer", async () => {
		const { intent } = await intentAndCapture();
		await paymentTransfer(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);
		await expect(
			paymentTransfer(
				{ payment_intent_id: intent.payment_provider_transaction_id },
				dataDb,
			),
		).rejects.toThrow("payment intent already transferred");
	});

	it("with MOCK_TRANSFER_FAILURE_AMOUNT appends failed row and transfer_failed message", async () => {
		const request = validPaymentIntentRequest({
			amount: MOCK_TRANSFER_FAILURE_AMOUNT,
		});
		await seedAuthorizationMessage(testDb, request);
		const intent = await paymentIntent(request, dataDb);
		await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);
		await paymentTransfer(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);

		const rows = await findRowsByIntentId(
			dataDb,
			intent.payment_provider_transaction_id,
		);
		expect(hasRow(rows, "transfer", "failed")).toBe(true);
		expect(hasRow(rows, "transfer", "succeeded")).toBe(false);
		expect(hasRow(rows, "transfer", "completed")).toBe(false);

		const messages = await testDb.select().from(schema.message);
		expect(messages.some((row) => row.value === "transfer_failed")).toBe(
			true,
		);
	});

	it("is reachable via api{service:evy, method:payment_transfer}", async () => {
		const { intent } = await intentAndCapture();
		const transferred = await api(
			{
				service: EVY_CORE_SERVICE,
				method: "payment_transfer",
				data: {
					payment_intent_id: intent.payment_provider_transaction_id,
				},
			},
			dataDb,
		);

		expect(transferred).toMatchObject({
			type: "transfer",
			status: "initiated",
			payment_provider_transaction_id:
				intent.payment_provider_transaction_id,
		});
	});

	it("rejects an invalid payment transfer request", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "payment_transfer",
					data: { payment_intent_id: "" },
				},
				dataDb,
			),
		).rejects.toThrow("PaymentTransferRequest validation failed");
	});
});
