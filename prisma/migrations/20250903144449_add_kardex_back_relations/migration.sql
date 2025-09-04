-- CreateEnum
CREATE TYPE "public"."KardexApplyMode" AS ENUM ('delta', 'set');

-- AlterTable
ALTER TABLE "public"."FormEntry" ADD COLUMN     "kardexApplied" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."FormKardexRule" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL,
    "nameKey" TEXT,
    "qtyKey" TEXT NOT NULL,
    "mode" "public"."KardexApplyMode" NOT NULL DEFAULT 'delta',
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "createIfMissing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormKardexRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KardexTxn" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qtyDelta" DECIMAL(18,3) NOT NULL,
    "prevQty" DECIMAL(18,3),
    "newQty" DECIMAL(18,3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KardexTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormKardexRule_formId_key" ON "public"."FormKardexRule"("formId");

-- CreateIndex
CREATE INDEX "KardexTxn_itemId_idx" ON "public"."KardexTxn"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "KardexTxn_entryId_key" ON "public"."KardexTxn"("entryId");

-- AddForeignKey
ALTER TABLE "public"."FormKardexRule" ADD CONSTRAINT "FormKardexRule_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KardexTxn" ADD CONSTRAINT "KardexTxn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."KardexItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KardexTxn" ADD CONSTRAINT "KardexTxn_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."FormEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KardexTxn" ADD CONSTRAINT "KardexTxn_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
