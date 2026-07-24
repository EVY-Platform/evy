CREATE TYPE "public"."Visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fk" uuid NOT NULL,
	"service" uuid NOT NULL,
	"resource" uuid NOT NULL,
	"archived_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"status" text NOT NULL,
	"data" jsonb NOT NULL,
	"visibility" "Visibility" DEFAULT 'public' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Address" ADD COLUMN "visibility" "Visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "Device" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "File" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "Flow" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "Organization" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "Page" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "Row" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "Service" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "ServiceProvider" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "ServiceResource" ADD COLUMN "visibility" "Visibility" DEFAULT 'public' NOT NULL;