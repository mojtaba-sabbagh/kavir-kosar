-- AlterTable
ALTER TABLE "public"."FormEntry" ADD COLUMN     "finalConfirmedById" TEXT;

-- AddForeignKey
ALTER TABLE "public"."FormEntry" ADD CONSTRAINT "FormEntry_finalConfirmedById_fkey" FOREIGN KEY ("finalConfirmedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
