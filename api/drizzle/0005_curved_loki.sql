CREATE TABLE "ServiceResource" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fk_service_id" uuid NOT NULL,
	"singular_name" varchar(50) NOT NULL,
	"plural_name" varchar(50) NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ServiceResource_fk_service_id_plural_name_key" ON "ServiceResource" USING btree ("fk_service_id","plural_name");