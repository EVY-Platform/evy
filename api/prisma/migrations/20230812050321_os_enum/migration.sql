/*
  Warnings:

  - Changed the type of `os` on the `Device` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OS" AS ENUM ('ios', 'android');

-- AlterTable
ALTER TABLE "Device" DROP COLUMN "os",
ADD COLUMN     "os" "OS" NOT NULL;
