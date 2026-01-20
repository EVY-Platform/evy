CREATE TYPE "public"."OS" AS ENUM('ios', 'android', 'Web');--> statement-breakpoint
CREATE TABLE "Device" (
	"token" varchar(256) PRIMARY KEY NOT NULL,
	"os" "OS" NOT NULL,
	"created_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Flow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Organization" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"logo" uuid NOT NULL,
	"url" varchar(50) NOT NULL,
	"support_email" varchar(50) NOT NULL,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	CONSTRAINT "Organization_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Service" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	CONSTRAINT "Service_name_unique" UNIQUE("name")
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
	"created_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ServiceProvider_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Device_token_os_key" ON "Device" USING btree ("token","os");--> statement-breakpoint
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "Service_name_key" ON "Service" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ServiceProvider_name_key" ON "ServiceProvider" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ServiceProvider_fk_service_id_fk_organization_id_key" ON "ServiceProvider" USING btree ("fk_service_id","fk_organization_id");