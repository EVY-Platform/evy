CREATE TYPE "public"."os" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "address" (
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
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "device" (
	"token" varchar(256) PRIMARY KEY NOT NULL,
	"os" "os" NOT NULL,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "flow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"page_ids" jsonb NOT NULL,
	"submits" jsonb,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "formatter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"formatting_config" text NOT NULL,
	"formatting" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fk" uuid NOT NULL,
	"resource" varchar(100) NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"data" jsonb NOT NULL,
	"parent_message_id" uuid,
	"visibility" "visibility" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"logo" uuid NOT NULL,
	"url" varchar(50) NOT NULL,
	"support_email" varchar(50) NOT NULL,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"row_ids" jsonb NOT NULL,
	"footer_row_id" uuid,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"visible" text NOT NULL,
	"data" jsonb NOT NULL,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"ws_host" varchar(253),
	"ws_port" integer,
	"sort_order" integer,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "service_provider" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fk_service_id" varchar(50) NOT NULL,
	"fk_organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"logo" uuid NOT NULL,
	"url" varchar(50) NOT NULL,
	"visibility" "visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fk" uuid NOT NULL,
	"resource" varchar(100) NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
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
--> statement-breakpoint
CREATE UNIQUE INDEX "device_token_os_key" ON "device" USING btree ("token","os");--> statement-breakpoint
CREATE UNIQUE INDEX "formatter_name_key" ON "formatter" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_name_key" ON "organization" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_name_key" ON "service" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_provider_name_key" ON "service_provider" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_provider_fk_service_id_fk_organization_id_key" ON "service_provider" USING btree ("fk_service_id","fk_organization_id");