CREATE TABLE "Data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
