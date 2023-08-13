/*
  Warnings:

  - You are about to alter the column `name` on the `Service` table. The data in that column could be lost. The data in that column will be cast from `VarChar(256)` to `VarChar(50)`.

*/
-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "name" SET DATA TYPE VARCHAR(50);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "logo" UUID NOT NULL,
    "url" VARCHAR(50) NOT NULL,
    "support_email" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
