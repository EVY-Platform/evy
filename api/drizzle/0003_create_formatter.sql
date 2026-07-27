CREATE TABLE "Formatter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"formatting_config" text NOT NULL,
	"formatting" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Formatter_name_key" ON "Formatter" USING btree ("name");
