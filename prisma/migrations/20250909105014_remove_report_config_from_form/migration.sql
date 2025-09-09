/*
  Warnings:

  - You are about to drop the column `defaultOrder` on the `FormReport` table. All the data in the column will be lost.
  - You are about to drop the column `filterableKeys` on the `FormReport` table. All the data in the column will be lost.
  - You are about to drop the column `orderableKeys` on the `FormReport` table. All the data in the column will be lost.
  - You are about to drop the column `visibleColumns` on the `FormReport` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."FormReport" DROP COLUMN "defaultOrder",
DROP COLUMN "filterableKeys",
DROP COLUMN "orderableKeys",
DROP COLUMN "visibleColumns";
