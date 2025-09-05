/*
  Warnings:

  - You are about to drop the column `qtyDelta` on the `KardexTxn` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `KardexTxn` table. All the data in the column will be lost.
  - Added the required column `amount` to the `KardexTxn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `appliedById` to the `KardexTxn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `delta` to the `KardexTxn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `op` to the `KardexTxn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."KardexTxn" DROP COLUMN "qtyDelta",
DROP COLUMN "userId",
ADD COLUMN     "amount" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "appliedById" TEXT NOT NULL,
ADD COLUMN     "delta" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "op" TEXT NOT NULL;
