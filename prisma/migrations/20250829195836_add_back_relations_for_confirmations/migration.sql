-- CreateEnum
CREATE TYPE "public"."ConfirmationStatus" AS ENUM ('pending', 'approved', 'superseded');

-- CreateTable
CREATE TABLE "public"."FormConfirmer" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FormConfirmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FormFinalConfirmer" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FormFinalConfirmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConfirmationTask" (
    "id" TEXT NOT NULL,
    "formEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."ConfirmationStatus" NOT NULL DEFAULT 'pending',
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "ConfirmationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormConfirmer_userId_idx" ON "public"."FormConfirmer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FormConfirmer_formId_userId_key" ON "public"."FormConfirmer"("formId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FormFinalConfirmer_formId_key" ON "public"."FormFinalConfirmer"("formId");

-- CreateIndex
CREATE INDEX "FormFinalConfirmer_userId_idx" ON "public"."FormFinalConfirmer"("userId");

-- CreateIndex
CREATE INDEX "ConfirmationTask_userId_isFinal_status_idx" ON "public"."ConfirmationTask"("userId", "isFinal", "status");

-- CreateIndex
CREATE INDEX "ConfirmationTask_formEntryId_isFinal_status_idx" ON "public"."ConfirmationTask"("formEntryId", "isFinal", "status");

-- AddForeignKey
ALTER TABLE "public"."FormConfirmer" ADD CONSTRAINT "FormConfirmer_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormConfirmer" ADD CONSTRAINT "FormConfirmer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormFinalConfirmer" ADD CONSTRAINT "FormFinalConfirmer_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormFinalConfirmer" ADD CONSTRAINT "FormFinalConfirmer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfirmationTask" ADD CONSTRAINT "ConfirmationTask_formEntryId_fkey" FOREIGN KEY ("formEntryId") REFERENCES "public"."FormEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfirmationTask" ADD CONSTRAINT "ConfirmationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
