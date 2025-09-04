/*
  Warnings:

  - A unique constraint covering the columns `[formEntryId,userId,isFinal]` on the table `ConfirmationTask` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."ConfirmationTask_formEntryId_isFinal_status_idx";

-- DropIndex
DROP INDEX "public"."ConfirmationTask_userId_isFinal_status_idx";

-- AlterTable
ALTER TABLE "public"."ConfirmationTask" ALTER COLUMN "isFinal" DROP DEFAULT,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmationTask_formEntryId_userId_isFinal_key" ON "public"."ConfirmationTask"("formEntryId", "userId", "isFinal");
