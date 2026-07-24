CREATE TABLE "Address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit" text,
	"street" text,
	"city" text,
	"postcode" text,
	"state" text,
	"country" text,
	"latitude" numeric(28, 10),
	"longitude" numeric(28, 10),
	"instructions" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
