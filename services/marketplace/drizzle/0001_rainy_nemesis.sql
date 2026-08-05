CREATE TABLE "item_payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"authorization_message_id" uuid NOT NULL,
	"payment_intent_id" text NOT NULL,
	"created_at" text NOT NULL
);
