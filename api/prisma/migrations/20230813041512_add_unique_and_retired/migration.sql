/*
  Warnings:

  - A unique constraint covering the columns `[token,os]` on the table `Device` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Service` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `ServiceProvider` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fk_service_id,fk_organization_id]` on the table `ServiceProvider` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ServiceProvider" ADD COLUMN     "retired" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Device_token_os_key" ON "Device"("token", "os");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProvider_name_key" ON "ServiceProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProvider_fk_service_id_fk_organization_id_key" ON "ServiceProvider"("fk_service_id", "fk_organization_id");
