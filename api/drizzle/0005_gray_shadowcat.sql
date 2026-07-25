ALTER TABLE "Address" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "File" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "Flow" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "Organization" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "Page" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "Row" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "Service" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "ServiceProvider" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "ServiceResource" ADD COLUMN "deleted_at" text;