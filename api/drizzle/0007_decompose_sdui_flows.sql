ALTER TABLE "Flow" DROP COLUMN "data";
--> statement-breakpoint
ALTER TABLE "Flow" ADD COLUMN "name" text DEFAULT 'Flow' NOT NULL;
--> statement-breakpoint
ALTER TABLE "Flow" ADD COLUMN "page_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "Flow" ALTER COLUMN "name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "Flow" ALTER COLUMN "page_ids" DROP DEFAULT;
--> statement-breakpoint
CREATE TABLE "Page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"row_ids" jsonb NOT NULL,
	"footer_row_id" uuid,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"visible" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
