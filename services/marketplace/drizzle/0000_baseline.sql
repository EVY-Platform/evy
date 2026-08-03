CREATE TYPE "public"."item_status" AS ENUM('available', 'pickup_pending', 'delivery_pending', 'shipping_pending', 'sold');--> statement-breakpoint
CREATE TABLE "data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "item_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"status" "item_status" NOT NULL,
	"created_at" text NOT NULL
);
