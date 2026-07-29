CREATE TYPE "public"."OS" AS ENUM('ios', 'android', 'Web');--> statement-breakpoint
CREATE TYPE "public"."Visibility" AS ENUM('public', 'private');--> statement-breakpoint
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
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "Device" (
	"token" varchar(256) PRIMARY KEY NOT NULL,
	"os" "OS" NOT NULL,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "File" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "Flow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"page_ids" jsonb NOT NULL,
	"submits" jsonb,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
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
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fk" uuid NOT NULL,
	"service" uuid NOT NULL,
	"resource" uuid NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"data" jsonb NOT NULL,
	"visibility" "Visibility" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Organization" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"logo" uuid NOT NULL,
	"url" varchar(50) NOT NULL,
	"support_email" varchar(50) NOT NULL,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "Page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"row_ids" jsonb NOT NULL,
	"footer_row_id" uuid,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "Row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"visible" text NOT NULL,
	"data" jsonb NOT NULL,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "Service" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"ws_host" varchar(253),
	"ws_port" integer,
	"sort_order" integer,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "ServiceProvider" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fk_service_id" uuid NOT NULL,
	"fk_organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"logo" uuid NOT NULL,
	"url" varchar(50) NOT NULL,
	"visibility" "Visibility" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Device_token_os_key" ON "Device" USING btree ("token","os");--> statement-breakpoint
CREATE UNIQUE INDEX "Formatter_name_key" ON "Formatter" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "Service_name_key" ON "Service" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ServiceProvider_name_key" ON "ServiceProvider" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ServiceProvider_fk_service_id_fk_organization_id_key" ON "ServiceProvider" USING btree ("fk_service_id","fk_organization_id");