-- CreateTable
CREATE TABLE "public"."KardexItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "openingQty" DECIMAL(18,3),
    "openingValue" DECIMAL(18,2),
    "currentQty" DECIMAL(18,3),
    "currentValue" DECIMAL(18,2),
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KardexItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KardexItem_code_key" ON "public"."KardexItem"("code");
