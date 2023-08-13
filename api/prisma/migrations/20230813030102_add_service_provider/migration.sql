-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" UUID NOT NULL,
    "fk_service_id" UUID NOT NULL,
    "fk_organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "logo" UUID NOT NULL,
    "url" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_fk_service_id_fkey" FOREIGN KEY ("fk_service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_fk_organization_id_fkey" FOREIGN KEY ("fk_organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
