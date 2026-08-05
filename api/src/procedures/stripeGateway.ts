import Stripe from "stripe";
import { createMockStripeGateway } from "./stripeGatewayMock";

export const PLACEHOLDER_STRIPE_SECRET_KEY = "stripekey";

const ZERO_DECIMAL_CURRENCIES = new Set([
	"BIF",
	"CLP",
	"DJF",
	"GNF",
	"JPY",
	"KMF",
	"KRW",
	"MGA",
	"PYG",
	"RWF",
	"UGX",
	"VND",
	"VUV",
	"XAF",
	"XOF",
	"XPF",
]);

export type StripeIntentParams = {
	amount: number;
	currency: string;
	metadata: {
		fk: string;
		resource: string;
		authorization_message_id: string;
	};
};

export type StripeCaptureOutcome = { ok: true } | { ok: false; reason: string };

export interface StripeGateway {
	createPaymentIntent(params: StripeIntentParams): Promise<{ id: string }>;
	capturePaymentIntent(
		id: string,
		amount: number,
	): Promise<StripeCaptureOutcome>;
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
	const normalizedCurrency = currency.toUpperCase();
	if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
		throw new Error(
			`zero-decimal currency not supported for Stripe amount conversion: ${currency}`,
		);
	}
	return Math.round(amount * 100);
}

function createRealStripeGateway(): StripeGateway {
	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error("Missing required env: STRIPE_SECRET_KEY");
	}
	let stripeClient: Stripe | undefined;
	const getStripe = (): Stripe => {
		if (!stripeClient) {
			stripeClient = new Stripe(secretKey);
		}
		return stripeClient;
	};
	return {
		async createPaymentIntent(params) {
			const paymentIntent = await getStripe().paymentIntents.create({
				amount: toStripeAmount(params.amount, params.currency),
				currency: params.currency.toLowerCase(),
				capture_method: "manual",
				confirm: true,
				payment_method: "pm_card_visa",
				payment_method_types: ["card"],
				metadata: params.metadata,
			});
			return { id: paymentIntent.id };
		},
		async capturePaymentIntent(id) {
			try {
				await getStripe().paymentIntents.capture(id);
				return { ok: true };
			} catch (error) {
				if (error instanceof Stripe.errors.StripeError) {
					return { ok: false, reason: error.message };
				}
				throw error;
			}
		},
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
