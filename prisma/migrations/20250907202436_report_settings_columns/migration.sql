/*
  Warnings:

  - You are about to drop the column `defaultOrderDir` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `defaultOrderKey` on the `Report` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Report" DROP COLUMN "defaultOrderDir",
DROP COLUMN "defaultOrderKey",
ADD COLUMN     "defaultOrder" JSONB;
