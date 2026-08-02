CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fk" uuid NOT NULL,
	"resource" varchar(100) NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(28, 10) NOT NULL,
	"currency" text NOT NULL,
	"payment_provider_fee" numeric(28, 10) NOT NULL,
	"service_fee" numeric(28, 10) NOT NULL,
	"payment_provider" text NOT NULL,
	"payment_provider_transaction_id" text NOT NULL,
	"signature" text NOT NULL,
	"authorization_message_id" uuid NOT NULL,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
