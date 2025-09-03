-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."FieldType" ADD VALUE 'entryRef';
ALTER TYPE "public"."FieldType" ADD VALUE 'entryRefMulti';

-- CreateTable
CREATE TABLE "public"."EntryRelation" (
    "id" TEXT NOT NULL,
    "sourceEntryId" TEXT NOT NULL,
    "targetEntryId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'relatesTo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryRelation_sourceEntryId_idx" ON "public"."EntryRelation"("sourceEntryId");

-- CreateIndex
CREATE INDEX "EntryRelation_targetEntryId_idx" ON "public"."EntryRelation"("targetEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryRelation_sourceEntryId_targetEntryId_relation_key" ON "public"."EntryRelation"("sourceEntryId", "targetEntryId", "relation");

-- AddForeignKey
ALTER TABLE "public"."EntryRelation" ADD CONSTRAINT "EntryRelation_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "public"."FormEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EntryRelation" ADD CONSTRAINT "EntryRelation_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "public"."FormEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
