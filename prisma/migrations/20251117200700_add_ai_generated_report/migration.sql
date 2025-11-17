-- CreateTable
CREATE TABLE "public"."AIGeneratedReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "generatedSql" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "formId" TEXT,
    "lastExecutedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIGeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIGeneratedReport_userId_createdAt_idx" ON "public"."AIGeneratedReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIGeneratedReport_formId_idx" ON "public"."AIGeneratedReport"("formId");
