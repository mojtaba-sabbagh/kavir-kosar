/*
  Warnings:

  - Added the required column `updatedAt` to the `Form` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."FieldType" AS ENUM ('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'file');

-- CreateEnum
CREATE TYPE "public"."EntryStatus" AS ENUM ('draft', 'submitted', 'confirmed', 'finalConfirmed');

-- DropForeignKey
ALTER TABLE "public"."RoleFormPermission" DROP CONSTRAINT "RoleFormPermission_formId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RoleFormPermission" DROP CONSTRAINT "RoleFormPermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserRole" DROP CONSTRAINT "UserRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserRole" DROP CONSTRAINT "UserRole_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Form" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."RoleFormPermission" ADD COLUMN     "canConfirm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canFinalConfirm" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "canRead" SET DEFAULT false,
ALTER COLUMN "canSubmit" SET DEFAULT false;

-- CreateTable
CREATE TABLE "public"."FormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelFa" TEXT NOT NULL,
    "type" "public"."FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FormEntry" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "formVersion" INTEGER NOT NULL DEFAULT 1,
    "firstConfirmedAt" TIMESTAMP(3),
    "finalConfirmedAt" TIMESTAMP(3),
    "status" "public"."EntryStatus" NOT NULL DEFAULT 'submitted',

    CONSTRAINT "FormEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormField_formId_key_key" ON "public"."FormField"("formId", "key");

-- CreateIndex
CREATE INDEX "FormEntry_formId_createdAt_idx" ON "public"."FormEntry"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "FormEntry_createdBy_createdAt_idx" ON "public"."FormEntry"("createdBy", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormEntry" ADD CONSTRAINT "FormEntry_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoleFormPermission" ADD CONSTRAINT "RoleFormPermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoleFormPermission" ADD CONSTRAINT "RoleFormPermission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
