/*
  Warnings:

  - You are about to drop the column `isActive` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Report` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[formId]` on the table `Report` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Report" DROP COLUMN "isActive",
DROP COLUMN "url",
ADD COLUMN     "formId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Report_formId_key" ON "public"."Report"("formId");

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
