ALTER TABLE "File" ADD COLUMN "type" text NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "File" ALTER COLUMN "type" DROP DEFAULT;
