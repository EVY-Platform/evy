import type { PaymentWebhookRequest } from "evy-types";
import Stripe from "stripe";
import type { EvyDb } from "../database/db";
import { handlePaymentWebhook } from "../procedures/paymentWebhook";
import { isStripeMockEnabled } from "../procedures/stripeGateway";

const STRIPE_WEBHOOK_PATH = "/webhooks/stripe";

type StripeEventMapping = {
	internalType: PaymentWebhookRequest["type"];
	getPaymentIntentId: (event: Stripe.Event) => string | undefined;
};

const STRIPE_EVENT_MAPPINGS: Partial<
	Record<Stripe.Event.Type, StripeEventMapping>
> = {
	"payment_intent.succeeded": {
		internalType: "payment_intent.capture_succeeded",
		getPaymentIntentId: (event) =>
			(event.data.object as Stripe.PaymentIntent).id,
	},
	"payment_intent.payment_failed": {
		internalType: "payment_intent.capture_failed",
		getPaymentIntentId: (event) =>
			(event.data.object as Stripe.PaymentIntent).id,
	},
	"charge.captured": {
		internalType: "charge.completed",
		getPaymentIntentId: (event) => {
			const charge = event.data.object as Stripe.Charge;
			const paymentIntent = charge.payment_intent;
			return typeof paymentIntent === "string"
				? paymentIntent
				: paymentIntent?.id;
		},
	},
};

function getWebhookSecret(): string | undefined {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	return secret && secret.length > 0 ? secret : undefined;
}

function getWebhookPort(): number {
	const port = Number(process.env.STRIPE_WEBHOOK_PORT ?? "8002");
	if (!Number.isInteger(port) || port <= 0) {
		throw new Error(
			`Invalid STRIPE_WEBHOOK_PORT: ${process.env.STRIPE_WEBHOOK_PORT}`,
		);
	}
	return port;
}

export async function handleStripeWebhookRequest(
	req: Request,
	db: EvyDb,
): Promise<Response> {
	if (req.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const webhookSecret = getWebhookSecret();
	if (!webhookSecret) {
		return new Response("Webhook secret not configured", { status: 500 });
	}

	const signature = req.headers.get("stripe-signature");
	if (!signature) {
		return new Response("Missing stripe-signature header", { status: 400 });
	}

	const rawBody = await req.text();
	let event: Stripe.Event;
	try {
		event = await Stripe.webhooks.constructEventAsync(
			rawBody,
			signature,
			webhookSecret,
		);
	} catch {
		return new Response("Invalid signature", { status: 400 });
	}

	const mapping = STRIPE_EVENT_MAPPINGS[event.type];
	if (!mapping) {
		return Response.json({ received: true });
	}

	const paymentIntentId = mapping.getPaymentIntentId(event);
	if (!paymentIntentId) {
		return new Response("Missing payment intent id", { status: 400 });
	}

	try {
		await handlePaymentWebhook(
			{
				type: mapping.internalType,
				payment_intent_id: paymentIntentId,
			},
			db,
		);
	} catch {
		return new Response("Webhook handler failed", { status: 500 });
	}

	return Response.json({ received: true });
}

export function startStripeWebhookServer(
	db: EvyDb,
): { stop: () => void } | undefined {
	if (isStripeMockEnabled()) {
		console.info(
			"Stripe webhook HTTP server skipped (STRIPE_MOCK mode enabled)",
		);
		return undefined;
	}

	const webhookSecret = getWebhookSecret();
	if (!webhookSecret) {
		console.info(
			"Stripe webhook HTTP server skipped (STRIPE_WEBHOOK_SECRET not set)",
		);
		return undefined;
	}

	const port = getWebhookPort();
	const server = Bun.serve({
		port,
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname !== STRIPE_WEBHOOK_PATH) {
				return new Response("Not Found", { status: 404 });
			}
			return handleStripeWebhookRequest(req, db);
		},
	});

	console.info(
		`Stripe webhook HTTP server listening on port ${port}${STRIPE_WEBHOOK_PATH}`,
	);

	return {
		stop: () => {
			server.stop();
		},
	};
}
