import Stripe from "stripe";
import { createMockStripeGateway } from "./stripeGatewayMock";

export const PLACEHOLDER_STRIPE_SECRET_KEY = "stripekey";

export type StripeIntentParams = {
	amount: number;
	currency: string;
	metadata: {
		fk: string;
		resource: string;
		authorization_message_id: string;
	};
};

type StripeOutcome = { ok: true } | { ok: false; reason: string };

export type StripeTransferParams = {
	paymentIntentId: string;
	amount: number;
	currency: string;
	metadata: {
		fk: string;
		resource: string;
		authorization_message_id: string;
	};
};

export interface StripeGateway {
	createPaymentIntent(params: StripeIntentParams): Promise<{ id: string }>;
	capturePaymentIntent(id: string, amount: number): Promise<StripeOutcome>;
	cancelPaymentIntent(id: string): Promise<StripeOutcome>;
	createTransfer(params: StripeTransferParams): Promise<StripeOutcome>;
}

let stripeGateway: StripeGateway | undefined;

export function setStripeGatewayForTests(
	gateway: StripeGateway | undefined,
): void {
	stripeGateway = gateway;
}

export function isStripeMockEnabled(): boolean {
	const mockFlag = process.env.STRIPE_MOCK;
	if (mockFlag === "true") {
		return true;
	}
	if (mockFlag === "false") {
		return false;
	}
	const secretKey = process.env.STRIPE_SECRET_KEY;
	return !secretKey || secretKey === PLACEHOLDER_STRIPE_SECRET_KEY;
}

export function toStripeAmount(amount: number, currency: string): number {
	if (currency.toUpperCase() !== "AUD") {
		throw new Error(
			`unsupported currency for Stripe amount conversion: ${currency}`,
		);
	}
	return Math.round(amount * 100);
}

function createRealStripeGateway(): StripeGateway {
	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error("Missing required env: STRIPE_SECRET_KEY");
	}
	const connectAccountId = process.env.STRIPE_CONNECT_ACCOUNT_ID;
	if (!connectAccountId) {
		throw new Error("Missing required env: STRIPE_CONNECT_ACCOUNT_ID");
	}
	const stripe = new Stripe(secretKey);

	// Stripe API errors become { ok: false } outcomes; anything else propagates.
	// The callback may return its own failure outcome before the Stripe call.
	async function stripeCall(
		fn: () => Promise<StripeOutcome | undefined>,
	): Promise<StripeOutcome> {
		try {
			return (await fn()) ?? { ok: true };
		} catch (error) {
			if (error instanceof Stripe.errors.StripeError) {
				return { ok: false, reason: error.message };
			}
			throw error;
		}
	}

	return {
		async createPaymentIntent(params) {
			const paymentIntent = await stripe.paymentIntents.create({
				amount: toStripeAmount(params.amount, params.currency),
				currency: params.currency.toLowerCase(),
				capture_method: "manual",
				// Sandbox-only: auto-confirm with Stripe's test card. Live mode
				// needs a real payment method collected from the buyer.
				confirm: true,
				payment_method: "pm_card_visa",
				payment_method_types: ["card"],
				metadata: params.metadata,
			});
			return { id: paymentIntent.id };
		},
		capturePaymentIntent: (id) =>
			stripeCall(async () => {
				await stripe.paymentIntents.capture(id);
				return undefined;
			}),
		cancelPaymentIntent: (id) =>
			stripeCall(async () => {
				await stripe.paymentIntents.cancel(id);
				return undefined;
			}),
		createTransfer: (params) =>
			stripeCall(async () => {
				const paymentIntent = await stripe.paymentIntents.retrieve(
					params.paymentIntentId,
				);
				const latestCharge = paymentIntent.latest_charge;
				const chargeId =
					typeof latestCharge === "string"
						? latestCharge
						: latestCharge?.id;
				if (!chargeId) {
					return {
						ok: false,
						reason: "payment intent has no charge to transfer from",
					};
				}
				await stripe.transfers.create({
					amount: toStripeAmount(params.amount, params.currency),
					currency: params.currency.toLowerCase(),
					destination: connectAccountId,
					source_transaction: chargeId,
					metadata: params.metadata,
				});
				return undefined;
			}),
	};
}

export function getStripeGateway(): StripeGateway {
	if (stripeGateway) {
		return stripeGateway;
	}
	if (isStripeMockEnabled()) {
		stripeGateway = createMockStripeGateway();
		return stripeGateway;
	}
	stripeGateway = createRealStripeGateway();
	return stripeGateway;
}
