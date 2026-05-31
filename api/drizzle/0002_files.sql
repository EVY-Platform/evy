DROP TABLE IF EXISTS "Image";--> statement-breakpoint
CREATE TABLE "File" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
