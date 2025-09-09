-- CreateTable
CREATE TABLE "public"."FormReport" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "visibleColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orderableKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultOrder" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormReport_formId_key" ON "public"."FormReport"("formId");

-- AddForeignKey
ALTER TABLE "public"."FormReport" ADD CONSTRAINT "FormReport_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
