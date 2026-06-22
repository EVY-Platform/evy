ALTER TABLE "ServiceResource" ADD COLUMN "name" varchar(50);
--> statement-breakpoint
UPDATE "ServiceResource" SET "name" = "singular_name";
--> statement-breakpoint
ALTER TABLE "ServiceResource" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "ServiceResource_fk_service_id_name_key" ON "ServiceResource" USING btree ("fk_service_id","name");
--> statement-breakpoint
DROP INDEX "ServiceResource_fk_service_id_plural_name_key";
--> statement-breakpoint
ALTER TABLE "ServiceResource" DROP COLUMN "singular_name";
--> statement-breakpoint
ALTER TABLE "ServiceResource" DROP COLUMN "plural_name";
