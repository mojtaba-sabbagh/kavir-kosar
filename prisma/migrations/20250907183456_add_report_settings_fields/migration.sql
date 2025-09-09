-- CreateEnum
CREATE TYPE "public"."SortDir" AS ENUM ('asc', 'desc');

-- AlterTable
ALTER TABLE "public"."Report" ADD COLUMN     "defaultOrderDir" "public"."SortDir",
ADD COLUMN     "defaultOrderKey" TEXT,
ADD COLUMN     "filterableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orderableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visibleColumns" TEXT[] DEFAULT ARRAY[]::TEXT[];
