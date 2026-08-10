import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { MOCK_CAPTURE_FAILURE_AMOUNT } from "evy-types/paymentMocks";
import {
	getStripeGateway,
	isStripeMockEnabled,
	PLACEHOLDER_STRIPE_SECRET_KEY,
	setStripeGatewayForTests,
	toStripeAmount,
} from "../procedures/stripeGateway";
import { createMockStripeGateway } from "../procedures/stripeGatewayMock";
import { stashEnv } from "./wsTestHelpers";

describe("isStripeMockEnabled", () => {
	let restoreEnv: (() => void) | undefined;

	beforeEach(() => {
		restoreEnv = stashEnv({
			STRIPE_MOCK: undefined,
			STRIPE_SECRET_KEY: undefined,
		});
		setStripeGatewayForTests(undefined);
	});

	afterEach(() => {
		restoreEnv?.();
		setStripeGatewayForTests(undefined);
	});

	it("returns true when STRIPE_MOCK=true", () => {
		process.env.STRIPE_MOCK = "true";
		expect(isStripeMockEnabled()).toBe(true);
	});

	it("returns false when STRIPE_MOCK=false", () => {
		process.env.STRIPE_MOCK = "false";
		process.env.STRIPE_SECRET_KEY = "sk_test_real";
		expect(isStripeMockEnabled()).toBe(false);
	});

	it("returns true when key is missing", () => {
		expect(isStripeMockEnabled()).toBe(true);
	});

	it("returns true when key is the placeholder", () => {
		process.env.STRIPE_SECRET_KEY = PLACEHOLDER_STRIPE_SECRET_KEY;
		expect(isStripeMockEnabled()).toBe(true);
	});

	it("returns false when key is real and STRIPE_MOCK is unset", () => {
		process.env.STRIPE_SECRET_KEY = "sk_test_real";
		expect(isStripeMockEnabled()).toBe(false);
	});
});

describe("toStripeAmount", () => {
	it("converts whole currency units to minor units for AUD", () => {
		expect(toStripeAmount(250, "AUD")).toBe(25000);
		expect(toStripeAmount(6.66, "AUD")).toBe(666);
	});

	it("rejects unsupported currencies", () => {
		expect(() => toStripeAmount(100, "JPY")).toThrow(
			"unsupported currency for Stripe amount conversion",
		);
	});
});

describe("mock StripeGateway", () => {
	beforeEach(() => {
		setStripeGatewayForTests(createMockStripeGateway());
	});

	afterEach(() => {
		setStripeGatewayForTests(undefined);
	});

	it("returns pi_mock_ prefixed intent ids", async () => {
		const gateway = getStripeGateway();
		const result = await gateway.createPaymentIntent({
			amount: 250,
			currency: "AUD",
			metadata: {
				fk: crypto.randomUUID(),
				resource: "marketplace.items",
				authorization_message_id: crypto.randomUUID(),
			},
		});
		expect(result.id).toMatch(/^pi_mock_/);
	});

	it("captures successfully for normal amounts", async () => {
		const gateway = getStripeGateway();
		const result = await gateway.capturePaymentIntent("pi_mock_test", 250);
		expect(result).toEqual({ ok: true });
	});

	it("fails capture for MOCK_CAPTURE_FAILURE_AMOUNT", async () => {
		const gateway = getStripeGateway();
		const result = await gateway.capturePaymentIntent(
			"pi_mock_test",
			MOCK_CAPTURE_FAILURE_AMOUNT,
		);
		expect(result).toEqual({ ok: false, reason: "mock capture failure" });
	});

	it("transfers successfully for normal amounts", async () => {
		const gateway = getStripeGateway();
		const result = await gateway.createTransfer({
			paymentIntentId: "pi_mock_test",
			amount: 250,
			currency: "AUD",
			metadata: {
				fk: crypto.randomUUID(),
				resource: "marketplace.items",
				authorization_message_id: crypto.randomUUID(),
			},
		});
		expect(result).toEqual({ ok: true });
	});

	it("returns 4242 for the test payment method last-4", async () => {
		const gateway = getStripeGateway();
		expect(await gateway.getPaymentMethodLast4()).toBe("4242");
	});
});
