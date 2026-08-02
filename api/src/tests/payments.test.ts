import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PaymentIntentRequest } from "evy-types";
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
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
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

function validPaymentIntentRequest(): PaymentIntentRequest {
	return {
		fk: crypto.randomUUID(),
		resource: "marketplace.items",
		amount: 250,
		currency: "AUD",
		authorization_message_id: crypto.randomUUID(),
	};
}

describe("payment_intent procedure", () => {
	it("creates an intent transaction and returns it", async () => {
		const request = validPaymentIntentRequest();
		const created = await paymentIntent(request, dataDb);

		expect(created.id).toBeDefined();
		expect(created.created_at).toBeDefined();
		expect(created.updated_at).toBeDefined();
		expect(created.type).toBe("intent");
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
		expect(listed[0]).toMatchObject({ id: created.id, type: "intent" });

		const [row] = await testDb.select().from(schema.transaction);
		expect(row?.id).toBe(created.id);
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
			type: "intent",
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
	it("creates a capture row copying the intent fields and reusing its payment_provider_transaction_id", async () => {
		const intent = await paymentIntent(validPaymentIntentRequest(), dataDb);
		const captured = await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);

		expect(captured.type).toBe("capture");
		expect(captured.fk).toBe(intent.fk);
		expect(captured.resource).toBe(intent.resource);
		expect(captured.amount).toBe(intent.amount);
		expect(captured.currency).toBe(intent.currency);
		expect(captured.authorization_message_id).toBe(
			intent.authorization_message_id,
		);
		expect(captured.payment_provider_transaction_id).toBe(
			intent.payment_provider_transaction_id,
		);
		expect(captured.id).not.toBe(intent.id);
	});

	it("rejects an unknown intent id", async () => {
		await expect(
			paymentCapture({ payment_intent_id: crypto.randomUUID() }, dataDb),
		).rejects.toThrow("payment intent not found");
	});

	it("rejects a second capture of the same intent", async () => {
		const intent = await paymentIntent(validPaymentIntentRequest(), dataDb);
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

	it("is reachable via api{service:evy, method:payment_capture}", async () => {
		const intent = await paymentIntent(validPaymentIntentRequest(), dataDb);
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
			type: "capture",
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
		const intent = await paymentIntent(validPaymentIntentRequest(), dataDb);
		const captured = await paymentCapture(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);
		return { intent, captured };
	}

	it("creates a transfer row reusing the intent payment_provider_transaction_id", async () => {
		const { intent } = await intentAndCapture();
		const transferred = await paymentTransfer(
			{ payment_intent_id: intent.payment_provider_transaction_id },
			dataDb,
		);

		expect(transferred.type).toBe("transfer");
		expect(transferred.fk).toBe(intent.fk);
		expect(transferred.resource).toBe(intent.resource);
		expect(transferred.amount).toBe(intent.amount);
		expect(transferred.currency).toBe(intent.currency);
		expect(transferred.authorization_message_id).toBe(
			intent.authorization_message_id,
		);
		expect(transferred.payment_provider_transaction_id).toBe(
			intent.payment_provider_transaction_id,
		);
		expect(transferred.id).not.toBe(intent.id);
	});

	it("rejects when no capture exists yet", async () => {
		const intent = await paymentIntent(validPaymentIntentRequest(), dataDb);
		await expect(
			paymentTransfer(
				{ payment_intent_id: intent.payment_provider_transaction_id },
				dataDb,
			),
		).rejects.toThrow("payment intent not captured");
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
