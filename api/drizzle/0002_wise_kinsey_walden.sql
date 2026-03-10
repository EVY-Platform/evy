ALTER TABLE "Organization" DROP CONSTRAINT "Organization_name_unique";--> statement-breakpoint
ALTER TABLE "Service" DROP CONSTRAINT "Service_name_unique";--> statement-breakpoint
ALTER TABLE "ServiceProvider" DROP CONSTRAINT "ServiceProvider_name_unique";--> statement-breakpoint
ALTER TABLE "Data" ADD COLUMN "namespace" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "Data" ADD COLUMN "resource" varchar(50) NOT NULL;