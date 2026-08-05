import type { PaymentWebhookRequest } from "evy-types";
import Stripe from "stripe";
import type { EvyDb } from "../database/db";
import { handlePaymentWebhook } from "../procedures/paymentWebhook";
import { isStripeMockEnabled } from "../procedures/stripeGateway";

const STRIPE_WEBHOOK_PATH = "/webhooks/stripe";

const STRIPE_EVENT_TYPE_MAP: Partial<
	Record<Stripe.Event.Type, PaymentWebhookRequest["type"]>
> = {
	"payment_intent.succeeded": "payment_intent.capture_succeeded",
	"payment_intent.payment_failed": "payment_intent.capture_failed",
	"charge.captured": "charge.completed",
};

function extractPaymentIntentId(event: Stripe.Event): string | undefined {
	const object = event.data.object;
	if (object.object === "charge") {
		const paymentIntent = object.payment_intent;
		return typeof paymentIntent === "string"
			? paymentIntent
			: paymentIntent?.id;
	}
	return "id" in object ? object.id : undefined;
}

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

	const internalType = STRIPE_EVENT_TYPE_MAP[event.type];
	if (!internalType) {
		return Response.json({ received: true });
	}

	const paymentIntentId = extractPaymentIntentId(event);
	if (!paymentIntentId) {
		return new Response("Missing payment intent id", { status: 400 });
	}

	try {
		await handlePaymentWebhook(
			{ type: internalType, payment_intent_id: paymentIntentId },
			db,
		);
	} catch {
		return new Response("Webhook handler failed", { status: 500 });
	}

	return Response.json({ received: true });
}

export function startStripeWebhookServer(db: EvyDb): void {
	if (isStripeMockEnabled()) {
		console.info(
			"Stripe webhook HTTP server skipped (STRIPE_MOCK mode enabled)",
		);
		return;
	}

	const webhookSecret = getWebhookSecret();
	if (!webhookSecret) {
		console.info(
			"Stripe webhook HTTP server skipped (STRIPE_WEBHOOK_SECRET not set)",
		);
		return;
	}

	const port = getWebhookPort();
	Bun.serve({
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
}
