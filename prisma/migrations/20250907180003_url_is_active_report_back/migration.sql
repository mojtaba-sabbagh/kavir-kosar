-- AlterTable
ALTER TABLE "public"."Report" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "url" TEXT;
